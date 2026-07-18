import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cappedCurrencyIncrement } from "@/lib/currency";
import { getSeasonKey } from "@/lib/games";
import { getPlayerLevelProgress } from "@/lib/playerLevel";
import { prisma } from "@/lib/prisma";
import {
  calculateYanmarCrashScore,
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

        const { ensureYanmarGearMigration } = await import("@/games/yanmar/gearMigrate");
        await ensureYanmarGearMigration(tx, session.user.id);
        const {
          loadUserFinalStats,
          tryWorkGearDrop,
          tryWorkEnhanceCoresDrop,
          applyMasterScoreXpBonus,
          applyWorkExpGainSub,
          serializeWorkGearDrop,
        } = await import("@/games/yanmar/gearService");
        const loaded = await loadUserFinalStats(tx, session.user.id);
        const { loadActiveShopBuffIds } = await import("@/games/yanmar/shopBuffServer");
        const {
          applyShopBuffsToStats,
          applyRankerWillScore,
        } = await import("@/games/yanmar/shopBuffEffects");
        const {
          workshopScoreMult,
          workshopXpMult,
        } = await import("@/games/yanmar/workshop/effects");
        const buffIds = await loadActiveShopBuffIds(session.user.id);
        const stats = applyShopBuffsToStats(loaded.stats, buffIds);
        const critical = Math.random() < stats.criticalChance;
        let score = calculateYanmarCrashScore(stats, critical);
        let xpGained: number = xpReward;
        const boosted = applyMasterScoreXpBonus(
          "breaker",
          score,
          xpGained,
          stats.activeMasters,
        );
        score = Math.round(
          applyRankerWillScore(boosted.score, buffIds) *
            workshopScoreMult(loaded.workshopById.crash.score_rank ?? 0),
        );
        xpGained = Math.round(
          applyWorkExpGainSub(boosted.xp, stats.workExpGainBonus, {
            workXpMult: stats.workXpMult,
          }) * workshopXpMult(loaded.workshopById.crash.xp_expert ?? 0),
        );
        const rolled = rollYanmarDropRewards({
          score,
          minStars: minStarReward,
          maxStars: maxStarReward,
          seasonKey: getSeasonKey(),
          critical,
        });
        const currencyUser = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { currency: true },
        });
        const { next, granted } = cappedCurrencyIncrement(
          currencyUser?.currency ?? 0,
          rolled.stars.stars,
        );
        const issued = await persistYanmarDropRewards({
          tx,
          userId: session.user.id,
          gameId: GAME_ID,
          stars: { ...rolled.stars, stars: granted },
          coupon: rolled.coupon,
          metadata: { eventId, xpGained },
        });
        const gearDrop = serializeWorkGearDrop(
          await tryWorkGearDrop(tx, session.user.id, "breaker"),
        );
        const coreDrop = await tryWorkEnhanceCoresDrop(
          tx,
          session.user.id,
          "breaker",
        );
        const totalStars = granted;
        const updated = await tx.user.update({
          where: { id: session.user.id },
          data: {
            totalXp: { increment: xpGained },
            ...(granted > 0 ? { currency: next } : {}),
          },
          select: { currency: true, totalXp: true, enhanceCores: true },
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
          score,
          critical: issued.stars.critical,
          xpGained,
          totalStars,
          currency: updated.currency,
          totalXp: updated.totalXp,
          level: getPlayerLevelProgress(updated.totalXp).level,
          gearDrop,
          coresDropped: coreDrop.dropped ? coreDrop.amount : 0,
          enhanceCores: coreDrop.enhanceCores ?? updated.enhanceCores,
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
      coupon?: {
        couponType: import("@/generated/prisma/client").CouponType;
        discountPct: number;
      } | null;
    };
    if (payload.coupon) {
      const nickname = session.user.nickname ?? session.user.loginId;
      void publishTickerWinEvents([
        {
          kind: "coupon",
          nickname,
          message: formatTickerCouponMessage(
            nickname,
            payload.coupon.couponType,
            payload.coupon.discountPct,
          ),
        },
      ]).catch((error) => {
        console.error("[ticker] crash publish failed:", error);
      });
    }
  }

  return NextResponse.json(result.result);
}