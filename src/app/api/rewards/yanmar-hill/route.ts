import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSeasonKey } from "@/lib/games";
import { getPlayerLevelProgress } from "@/lib/playerLevel";
import { prisma } from "@/lib/prisma";
import {
  calculateYanmarEquipmentStats,
  calculateYanmarHillScore,
  mergeYanmarEquipmentLevelsFromDb,
  rollYanmarHillXp,
  YANMAR_HILL_REWARD_CONFIG,
} from "@/games/yanmar/equipment";
import {
  isYanmarRewardRateLimited,
  parseRewardEventId,
  persistYanmarDropRewards,
  rollYanmarDropRewards,
  runReplayableRewardEvent,
} from "@/lib/yanmar-rewards";

const GAME_ID = "yanmar-hill";
const REQUIRED_LEVEL = 15;
const { minStarReward, maxStarReward } = YANMAR_HILL_REWARD_CONFIG;

class RewardRateLimitError extends Error {}

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

    return runReplayableRewardEvent(
      tx,
      { userId: session.user.id, gameId: GAME_ID, eventId },
      async () => {
        if (
          await isYanmarRewardRateLimited(
            tx,
            session.user.id,
            GAME_ID,
            2_000,
          )
        ) {
          throw new RewardRateLimitError();
        }

        const rows = await tx.userEquipmentUpgrade.findMany({
          where: { userId: session.user.id, gameId: "yanmar" },
          select: { part: true, level: true },
        });
        const stats = calculateYanmarEquipmentStats(
          mergeYanmarEquipmentLevelsFromDb(rows),
        );
        const critical = Math.random() < stats.criticalChance;
        const score = calculateYanmarHillScore(stats, critical);
        const xpGained = rollYanmarHillXp();
        const rolled = rollYanmarDropRewards({
          score,
          minStars: minStarReward,
          maxStars: maxStarReward,
          seasonKey: getSeasonKey(),
          critical,
        });
        const issued = await persistYanmarDropRewards({
          tx,
          userId: session.user.id,
          gameId: GAME_ID,
          stars: rolled.stars,
          coupon: rolled.coupon,
          metadata: { eventId, xpGained, score, critical },
        });
        const totalStars = issued.stars.stars;
        const updated = await tx.user.update({
          where: { id: session.user.id },
          data: {
            totalXp: { increment: xpGained },
            ...(totalStars > 0 ? { currency: { increment: totalStars } } : {}),
          },
          select: { currency: true, totalXp: true },
        });

        return {
          eventId,
          reward: issued.stars,
          coupon: issued.coupon
            ? {
                ...issued.coupon,
                expiresAt: issued.coupon.expiresAt.toISOString(),
              }
            : null,
          score: issued.stars.score,
          critical: issued.stars.critical,
          xpGained,
          totalStars,
          currency: updated.currency,
          totalXp: updated.totalXp,
          level: getPlayerLevelProgress(updated.totalXp).level,
        };
      },
    );
  }).catch((error: unknown) => {
    if (error instanceof RewardRateLimitError) return null;
    throw error;
  });

  if (!result) {
    return NextResponse.json(
      { error: "Hill rewards are being claimed too quickly" },
      { status: 429 },
    );
  }

  if ("status" in result) {
    if (result.status === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      {
        error: `Level ${REQUIRED_LEVEL} required`,
        requiredLevel: REQUIRED_LEVEL,
        currentLevel: result.currentLevel,
      },
      { status: 403 },
    );
  }
  return NextResponse.json(result.result);
}