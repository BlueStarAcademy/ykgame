import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSeasonKey } from "@/lib/games";
import { getPlayerLevelProgress } from "@/lib/playerLevel";
import { prisma } from "@/lib/prisma";
import {
  lockAndCheckRewardEvent,
  isYanmarRewardRateLimited,
  parseRewardEventId,
  persistYanmarReward,
  randomInt,
  rollYanmarReward,
} from "@/lib/yanmar-rewards";

const GAME_ID = "yanmar-crash";
const REQUIRED_LEVEL = 10;
const XP_REWARD = 1000;
const MIN_STARS = 10;
const MAX_STARS = 25;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    eventId?: unknown;
  } | null;
  const eventId = parseRewardEventId(body?.eventId);
  if (!eventId) {
    return NextResponse.json(
      {
        error:
          "eventId is required and must be 1-128 letters, numbers, dots, underscores, colons, or hyphens",
      },
      { status: 400 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: session.user.id },
      select: { totalXp: true, isActive: true },
    });
    if (!user?.isActive) return { status: "unauthorized" as const };

    const currentLevel = getPlayerLevelProgress(user.totalXp).level;
    if (currentLevel < REQUIRED_LEVEL) {
      return { status: "level_locked" as const, currentLevel };
    }

    const duplicate = await lockAndCheckRewardEvent(
      tx,
      session.user.id,
      GAME_ID,
      eventId,
    );
    if (duplicate) return { status: "duplicate" as const };
    if (
      await isYanmarRewardRateLimited(
        tx,
        session.user.id,
        GAME_ID,
        10_000,
      )
    ) {
      return { status: "rate_limited" as const };
    }

    const score = randomInt(900, 1100);
    const reward = rollYanmarReward({
      score,
      minStars: MIN_STARS,
      maxStars: MAX_STARS,
      seasonKey: getSeasonKey(),
    });
    const issuedReward = await persistYanmarReward({
      tx,
      userId: session.user.id,
      gameId: GAME_ID,
      reward,
      minStars: MIN_STARS,
      maxStars: MAX_STARS,
      metadata: { eventId, xpGained: XP_REWARD },
    });
    const totalStars =
      issuedReward.kind === "stars" ? issuedReward.stars : 0;
    const updated = await tx.user.update({
      where: { id: session.user.id },
      data: {
        totalXp: { increment: XP_REWARD },
        ...(totalStars > 0 ? { currency: { increment: totalStars } } : {}),
      },
      select: { currency: true, totalXp: true },
    });

    return {
      status: "success" as const,
      reward: issuedReward,
      totalStars,
      currency: updated.currency,
      totalXp: updated.totalXp,
      level: getPlayerLevelProgress(updated.totalXp).level,
    };
  });

  if (result.status === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (result.status === "level_locked") {
    return NextResponse.json(
      {
        error: `Level ${REQUIRED_LEVEL} required`,
        requiredLevel: REQUIRED_LEVEL,
        currentLevel: result.currentLevel,
      },
      { status: 403 },
    );
  }
  if (result.status === "duplicate") {
    return NextResponse.json(
      { error: "Reward event already claimed", eventId },
      { status: 409 },
    );
  }
  if (result.status === "rate_limited") {
    return NextResponse.json(
      { error: "Crash rewards are being claimed too quickly" },
      { status: 429 },
    );
  }

  return NextResponse.json({
    eventId,
    reward: result.reward,
    score: result.reward.score,
    xpGained: XP_REWARD,
    totalStars: result.totalStars,
    currency: result.currency,
    totalXp: result.totalXp,
    level: result.level,
  });
}
