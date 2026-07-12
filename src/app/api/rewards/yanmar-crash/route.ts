import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSeasonKey } from "@/lib/games";
import { getPlayerLevelProgress } from "@/lib/playerLevel";
import { prisma } from "@/lib/prisma";
import {
  calculateYanmarCrashScore,
  calculateYanmarEquipmentStats,
  mergeYanmarEquipmentLevelsFromDb,
  YANMAR_CRASH_REWARD_CONFIG,
} from "@/games/yanmar/equipment";
import {
  isYanmarRewardRateLimited,
  parseRewardEventId,
  persistYanmarDropRewards,
  rollYanmarDropRewards,
  runReplayableRewardEvent,
} from "@/lib/yanmar-rewards";
import {
  formatTickerCouponMessage,
  formatTickerStarsMessage,
  publishTickerWinEvents,
} from "@/lib/ticker";

const GAME_ID = "yanmar-crash";
const REQUIRED_LEVEL = 10;
const { minStarReward, maxStarReward, xpReward } = YANMAR_CRASH_REWARD_CONFIG;
const REWARD_MIN_INTERVAL_MS = 1000;

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
            REWARD_MIN_INTERVAL_MS,
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
        const score = calculateYanmarCrashScore(stats, critical);
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
          metadata: { eventId, xpGained: xpReward },
        });
        const totalStars = issued.stars.stars;
        const updated = await tx.user.update({
          where: { id: session.user.id },
          data: {
            totalXp: { increment: xpReward },
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
          xpGained: xpReward,
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
      { error: "Crash rewards are being claimed too quickly" },
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

  if (!result.replayed) {
    const payload = result.result as {
      reward?: { stars?: number; critical?: boolean };
      coupon?: {
        couponType: import("@/generated/prisma/client").CouponType;
        discountPct: number;
      } | null;
      totalStars?: number;
    };
    const nickname = session.user.nickname ?? session.user.loginId;
    const tickerEvents: Array<{
      kind: "coupon" | "stars";
      message: string;
      nickname: string;
    }> = [];
    if (payload.coupon) {
      tickerEvents.push({
        kind: "coupon",
        nickname,
        message: formatTickerCouponMessage(
          nickname,
          payload.coupon.couponType,
          payload.coupon.discountPct,
        ),
      });
    }
    if ((payload.totalStars ?? payload.reward?.stars ?? 0) > 0) {
      tickerEvents.push({
        kind: "stars",
        nickname,
        message: formatTickerStarsMessage(
          nickname,
          payload.totalStars ?? payload.reward?.stars ?? 0,
          Boolean(payload.reward?.critical),
        ),
      });
    }
    void publishTickerWinEvents(tickerEvents).catch((error) => {
      console.error("[ticker] crash publish failed:", error);
    });
  }

  return NextResponse.json(result.result);
}