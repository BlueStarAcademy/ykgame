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

const GAME_ID = "yanmar-hill";
const REQUIRED_LEVEL = 15;
const MIN_STARS = 2;
const MAX_STARS = 5;

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
        2_000,
      )
    ) {
      return { status: "rate_limited" as const };
    }

    const xpGained = randomInt(90, 120);
    const score = xpGained;
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
      metadata: { eventId, xpGained },
    });
    const totalStars =
      issuedReward.kind === "stars" ? issuedReward.stars : 0;
    const updated = await tx.user.update({
      where: { id: session.user.id },
      data: {
        totalXp: { increment: xpGained },
        ...(totalStars > 0 ? { currency: { increment: totalStars } } : {}),
      },
      select: { currency: true, totalXp: true },
    });

    return {
      status: "success" as const,
      reward: issuedReward,
      xpGained,
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
      { error: "Hill rewards are being claimed too quickly" },
      { status: 429 },
    );
  }

  return NextResponse.json({
    eventId,
    reward: result.reward,
    score: result.reward.score,
    xpGained: result.xpGained,
    totalStars: result.totalStars,
    currency: result.currency,
    totalXp: result.totalXp,
    level: result.level,
  });
}
