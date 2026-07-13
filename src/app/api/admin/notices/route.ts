import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  clampTickerScrollSpeed,
  getTickerSettings,
  TICKER_SCROLL_SPEED_DEFAULT,
  TICKER_SCROLL_SPEED_MAX,
  TICKER_SCROLL_SPEED_MIN,
  upsertTickerScrollSpeed,
} from "@/lib/ticker";

const MAX_MESSAGE_LENGTH = 160;

function normalizeMessage(value: unknown) {
  if (typeof value !== "string") return null;
  const message = value.trim().replace(/\s+/g, " ");
  if (!message || message.length > MAX_MESSAGE_LENGTH) return null;
  return message;
}

export async function GET() {
  try {
    await requireAdmin();
    const notices = await prisma.tickerNotice.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    let scrollSpeedPx = TICKER_SCROLL_SPEED_DEFAULT;
    try {
      const settings = await getTickerSettings();
      scrollSpeedPx = settings.scrollSpeedPx;
    } catch (settingsError) {
      console.error("[admin/notices] settings load failed:", settingsError);
    }
    return NextResponse.json({
      notices,
      scrollSpeedPx,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("[admin/notices] GET failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json().catch(() => null)) as {
      message?: unknown;
      active?: unknown;
    } | null;
    const message = normalizeMessage(body?.message);
    if (!message) {
      return NextResponse.json(
        { error: `공지는 1~${MAX_MESSAGE_LENGTH}자로 입력해주세요.` },
        { status: 400 },
      );
    }

    const aggregate = await prisma.tickerNotice.aggregate({
      _max: { sortOrder: true },
    });
    const sortOrder = (aggregate._max.sortOrder ?? -1) + 1;
    const notice = await prisma.tickerNotice.create({
      data: {
        message,
        sortOrder,
        active: body?.active !== false,
      },
    });
    return NextResponse.json({ notice });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status = message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json().catch(() => null)) as {
      orderedIds?: unknown;
      scrollSpeedPx?: unknown;
    } | null;

    if (body?.scrollSpeedPx !== undefined) {
      const speed = clampTickerScrollSpeed(body.scrollSpeedPx);
      if (speed == null) {
        return NextResponse.json(
          {
            error: `스크롤 속도는 ${TICKER_SCROLL_SPEED_MIN}–${TICKER_SCROLL_SPEED_MAX} px/s 사이여야 합니다.`,
          },
          { status: 400 },
        );
      }
      const settings = await upsertTickerScrollSpeed(speed);
      return NextResponse.json({ scrollSpeedPx: settings.scrollSpeedPx });
    }

    const orderedIds = Array.isArray(body?.orderedIds)
      ? body.orderedIds.filter((id): id is string => typeof id === "string")
      : null;
    if (!orderedIds || orderedIds.length === 0) {
      return NextResponse.json({ error: "orderedIds required" }, { status: 400 });
    }

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.tickerNotice.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    const notices = await prisma.tickerNotice.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ notices });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status = message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}
