import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSeasonKey } from "@/lib/games";
import { getPlayerLevelProgress } from "@/lib/playerLevel";
import { prisma } from "@/lib/prisma";
import {
  calculateYanmarHillScore,
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
import {
  formatTickerCouponMessage,
  publishTickerWinEvents,
} from "@/lib/ticker";

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
        const buffIds = await loadActiveShopBuffIds(session.user.id);
        const stats = applyShopBuffsToStats(loaded.stats, buffIds);
        const critical = Math.random() < stats.criticalChance;
        let score = calculateYanmarHillScore(stats, critical);
        let xpGained = rollYanmarHillXp();
        const boosted = applyMasterScoreXpBonus(
          "hill",
          score,
          xpGained,
          stats.activeMasters,
        );
        score = applyRankerWillScore(boosted.score, buffIds);
        xpGained = applyWorkExpGainSub(boosted.xp, stats.workExpGainBonus, {
          workXpMult: stats.workXpMult,
        });
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
        const gearDrop = serializeWorkGearDrop(
          await tryWorkGearDrop(tx, session.user.id, "hillDump"),
        );
        const coreDrop = await tryWorkEnhanceCoresDrop(
          tx,
          session.user.id,
          "hillDump",
        );
        const totalStars = issued.stars.stars;
        const updated = await tx.user.update({
          where: { id: session.user.id },
          data: {
            totalXp: { increment: xpGained },
            ...(totalStars > 0 ? { currency: { increment: totalStars } } : {}),
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
        console.error("[ticker] hill publish failed:", error);
      });
    }
  }

  return NextResponse.json(result.result);
}