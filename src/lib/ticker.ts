import type { CouponType, Prisma } from "@/generated/prisma/client";
import { couponTypeLabel, isExchangeCoupon } from "@/lib/coupon";
import { prisma } from "@/lib/prisma";
import {
  clampTickerScrollSpeed,
  TICKER_SCROLL_SPEED_DEFAULT,
  TICKER_SCROLL_SPEED_MAX,
  TICKER_SCROLL_SPEED_MIN,
  TICKER_SETTINGS_ID,
} from "@/lib/ticker-constants";

export const TICKER_WIN_RETENTION_MS = 1000 * 60 * 60 * 6;
export const TICKER_WIN_FEED_LIMIT = 12;
export {
  clampTickerScrollSpeed,
  TICKER_LEFT_PAUSE_MS,
  TICKER_SCROLL_SPEED_DEFAULT,
  TICKER_SCROLL_SPEED_MAX,
  TICKER_SCROLL_SPEED_MIN,
  TICKER_SETTINGS_ID,
} from "@/lib/ticker-constants";

export type TickerFeedItem = {
  id: string;
  kind: "notice" | "coupon" | "practice";
  message: string;
  createdAt: string | null;
};

export type TickerSettings = {
  scrollSpeedPx: number;
};

function displayName(nickname: string | null | undefined) {
  const trimmed = nickname?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "익명의 조종사";
}

export function formatTickerCouponMessage(
  nickname: string | null | undefined,
  couponType: CouponType,
  discountPct: number,
) {
  const name = displayName(nickname);
  const label = couponTypeLabel(couponType);
  if (isExchangeCoupon(couponType)) {
    return `🎉 ${name}님이 ${label}을(를) 획득했습니다!`;
  }
  return `🎉 ${name}님이 ${label} ${discountPct}%를 획득했습니다!`;
}

export async function publishTickerWinEvents(
  events: Array<{
    kind: "coupon";
    message: string;
    nickname: string;
  }>,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  if (events.length === 0) return;

  const cutoff = new Date(Date.now() - TICKER_WIN_RETENTION_MS);
  await db.tickerWinEvent.createMany({
    data: events.map((event) => ({
      kind: event.kind,
      message: event.message.slice(0, 240),
      nickname: event.nickname.slice(0, 32),
    })),
  });
  await db.tickerWinEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
}

export async function getTickerSettings(): Promise<TickerSettings> {
  const delegate = (
    prisma as typeof prisma & {
      tickerSettings?: typeof prisma.tickerSettings;
    }
  ).tickerSettings;
  if (!delegate) {
    console.error(
      "[ticker] prisma.tickerSettings missing — restarting client may be required",
    );
    return { scrollSpeedPx: TICKER_SCROLL_SPEED_DEFAULT };
  }

  const row = await delegate.upsert({
    where: { id: TICKER_SETTINGS_ID },
    create: {
      id: TICKER_SETTINGS_ID,
      scrollSpeedPx: TICKER_SCROLL_SPEED_DEFAULT,
    },
    update: {},
    select: { scrollSpeedPx: true },
  });
  return {
    scrollSpeedPx:
      clampTickerScrollSpeed(row.scrollSpeedPx) ?? TICKER_SCROLL_SPEED_DEFAULT,
  };
}

export async function upsertTickerScrollSpeed(
  scrollSpeedPx: number,
): Promise<TickerSettings> {
  const speed = clampTickerScrollSpeed(scrollSpeedPx);
  if (speed == null) {
    throw new Error(
      `scrollSpeedPx must be ${TICKER_SCROLL_SPEED_MIN}–${TICKER_SCROLL_SPEED_MAX}`,
    );
  }
  const row = await prisma.tickerSettings.upsert({
    where: { id: TICKER_SETTINGS_ID },
    create: { id: TICKER_SETTINGS_ID, scrollSpeedPx: speed },
    update: { scrollSpeedPx: speed },
    select: { scrollSpeedPx: true },
  });
  return { scrollSpeedPx: row.scrollSpeedPx };
}

export async function getTickerFeed(options?: {
  includePractice?: boolean;
}): Promise<TickerFeedItem[]> {
  const cutoff = new Date(Date.now() - TICKER_WIN_RETENTION_MS);
  const [notices, wins] = await Promise.all([
    prisma.tickerNotice.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, message: true, updatedAt: true },
    }),
    prisma.tickerWinEvent.findMany({
      where: {
        createdAt: { gte: cutoff },
        kind: "coupon",
      },
      orderBy: { createdAt: "desc" },
      take: TICKER_WIN_FEED_LIMIT,
      select: { id: true, kind: true, message: true, createdAt: true },
    }),
  ]);

  const items: TickerFeedItem[] = [];

  if (options?.includePractice) {
    items.push({
      id: "practice",
      kind: "practice",
      message: "연습모드에서는 재화나 점수가 누적되지 않습니다.",
      createdAt: null,
    });
  }

  for (const notice of notices) {
    items.push({
      id: `notice:${notice.id}`,
      kind: "notice",
      message: notice.message.startsWith("[공지]")
        ? notice.message
        : `[공지] ${notice.message}`,
      createdAt: notice.updatedAt.toISOString(),
    });
  }

  for (const win of wins) {
    items.push({
      id: `win:${win.id}`,
      kind: "coupon",
      message: win.message,
      createdAt: win.createdAt.toISOString(),
    });
  }

  return items;
}
