import type { CouponType, Prisma } from "@/generated/prisma/client";
import { couponTypeLabel, isExchangeCoupon } from "@/lib/coupon";
import { prisma } from "@/lib/prisma";

export const TICKER_WIN_RETENTION_MS = 1000 * 60 * 60 * 6;
export const TICKER_WIN_FEED_LIMIT = 12;

export type TickerFeedItem = {
  id: string;
  kind: "notice" | "coupon" | "stars" | "practice";
  message: string;
  createdAt: string | null;
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

export function formatTickerStarsMessage(
  nickname: string | null | undefined,
  stars: number,
  critical = false,
) {
  const name = displayName(nickname);
  if (critical) {
    return `⭐ ${name}님이 크리티컬로 스타 ${stars.toLocaleString()}개를 획득했습니다!`;
  }
  return `⭐ ${name}님이 스타 ${stars.toLocaleString()}개에 당첨되었습니다!`;
}

export async function publishTickerWinEvents(
  events: Array<{
    kind: "coupon" | "stars";
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
      where: { createdAt: { gte: cutoff } },
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
      kind: win.kind === "coupon" ? "coupon" : "stars",
      message: win.message,
      createdAt: win.createdAt.toISOString(),
    });
  }

  return items;
}
