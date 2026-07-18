import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countSeasonGameDropCouponsGrouped } from "@/lib/coupon";
import {
  lockAndCanIssueYanmarCoupon,
  parseRewardEventId,
  rollYanmarDropRewards,
  runReplayableRewardEvent,
} from "@/lib/yanmar-rewards";
import {
  formatTickerCouponMessage,
  publishTickerWinEvents,
} from "@/lib/ticker";
import { getSeasonKey } from "@/lib/games";
import { withHotApiObservability } from "@/lib/hot-api-observability";
import { cappedCurrencyIncrement } from "@/lib/currency";
import { consumeDumpRateLimit } from "@/lib/redis-token-bucket";
import {
  YANMAR_REWARD_CONFIG,
  calculateYanmarChunkScore,
} from "@/games/yanmar/equipment";
import { ensureYanmarGearMigration } from "@/games/yanmar/gearMigrate";
import {
  applyMasterScoreXpBonus,
  applyWorkExpGainSub,
  loadUserFinalStats,
  serializeWorkGearDrop,
  tryWorkEnhanceCoresDrop,
  tryWorkGearDrop,
} from "@/games/yanmar/gearService";
import type { CouponType, Prisma } from "@/generated/prisma/client";

type DumpStarEvent = {
  kind: "stars";
  score: number;
  critical: boolean;
  stars: number;
};

type DumpCouponEvent = {
  kind: "coupon";
  score: number;
  critical: boolean;
  couponType: CouponType;
  discountPct: number;
  barcodeCode: string;
  expiresAt: Date;
  seasonKey: string;
};

type DumpRewardEvent = DumpCouponEvent | DumpStarEvent;

export const POST = withHotApiObservability(
  "/api/rewards/yanmar-dump",
  async (request, _routeContext, observation) => {
  const session = await auth();
  if (!session?.user) {
    observation.setMetadata({
      outcome: "unauthorized",
      errorCode: "UNAUTHORIZED",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    chunkCount?: unknown;
    eventId?: unknown;
  } | null;
  const eventId = parseRewardEventId(body?.eventId);
  if (!eventId) {
    observation.setMetadata({
      outcome: "invalid_request",
      errorCode: "INVALID_EVENT_ID",
    });
    return NextResponse.json(
      {
        error:
          "eventId is required and must be 1-128 letters, numbers, dots, underscores, colons, or hyphens",
      },
      { status: 400 },
    );
  }
  const chunkCount = body?.chunkCount;
  const safeChunkCount =
    typeof chunkCount === "number"
      ? Math.max(1, Math.min(20, Math.floor(chunkCount)))
      : 1;
  observation.setMetadata({ batchSize: safeChunkCount });

  const existing = await prisma.rewardEvent.findUnique({
    where: {
      userId_gameId_eventId: {
        userId: session.user.id,
        gameId: "yanmar-dump",
        eventId,
      },
    },
    select: { result: true },
  });
  if (existing) {
    observation.setMetadata({ outcome: "success", replayed: true });
    return NextResponse.json(existing.result);
  }

  // Rate limiting happens before opening a DB transaction. The Redis Lua script
  // records eventId atomically, so concurrent retries consume tokens only once.
  const rateLimit = await consumeDumpRateLimit(
    session.user.id,
    eventId,
    safeChunkCount,
  );
  if (rateLimit.bypassed) {
    observation.setMetadata({ rateLimitBypassed: true });
  }
  if (!rateLimit.allowed) {
    observation.setMetadata({
      outcome: "rate_limited",
      replayed: false,
      errorCode: "DUMP_RATE_LIMITED",
    });
    return NextResponse.json(
      { error: "Too many dump chunks" },
      { status: 429, headers: { "Retry-After": "1" } },
    );
  }

  await prisma.$transaction(async (tx) => {
    await ensureYanmarGearMigration(tx, session.user.id);
  });
  const loaded = await loadUserFinalStats(prisma, session.user.id);
  const { loadActiveShopBuffIds } = await import("@/games/yanmar/shopBuffServer");
  const {
    applyShopBuffsToStats,
    applyRankerWillScore,
  } = await import("@/games/yanmar/shopBuffEffects");
  const buffIds = await loadActiveShopBuffIds(session.user.id);
  const stats = applyShopBuffsToStats(loaded.stats, buffIds);
  const seasonKey = getSeasonKey();

  const issued = await countSeasonGameDropCouponsGrouped(prisma, seasonKey);

  const remaining = {
    parts: Math.max(
      0,
      YANMAR_REWARD_CONFIG.partsCouponSeasonLimit - issued.YK_PARTS_DISCOUNT,
    ),
    rental: Math.max(
      0,
      YANMAR_REWARD_CONFIG.rentalCouponSeasonLimit -
        issued.EQUIPMENT_RENTAL_DISCOUNT,
    ),
    filterSet: Math.max(
      0,
      YANMAR_REWARD_CONFIG.filterSetCouponSeasonLimit -
        issued.FILTER_SET_EXCHANGE,
    ),
  };

  const plannedChunks = Array.from({ length: safeChunkCount }, () => {
    const critical = Math.random() < stats.criticalChance;
    let score = calculateYanmarChunkScore(stats, critical);
    const boosted = applyMasterScoreXpBonus("soil", score, 0, stats.activeMasters);
    score = applyRankerWillScore(boosted.score, buffIds);
    const { stars, coupon } = rollYanmarDropRewards({
      score,
      minStars: YANMAR_REWARD_CONFIG.minStarReward,
      maxStars: YANMAR_REWARD_CONFIG.maxStarReward,
      seasonKey,
      critical,
      remaining,
    });
    return { score, stars, coupon };
  });

  /** 1 dump score chunk == scoreChunkUnits of soil == same amount of lifetime XP */
  let xpGained = applyWorkExpGainSub(
    stats.scoreChunkUnits * safeChunkCount,
    stats.workExpGainBonus,
    { workXpMult: stats.workXpMult },
  );
  const soilXpMaster = stats.activeMasters.soilDumpXpPct;
  if (soilXpMaster) {
    xpGained = Math.round(xpGained * (1 + soilXpMaster.value / 100));
  }

  const result = await prisma.$transaction(async (tx) => {
    return runReplayableRewardEvent(
      tx,
      { userId: session.user.id, gameId: "yanmar-dump", eventId },
      async () => {
        const responseEvents: DumpRewardEvent[] = [];
        const starInventoryRows: Prisma.UserRewardInventoryCreateManyInput[] = [];
        let totalStars = 0;
        let totalScore = 0;

        const currencyUser = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { currency: true },
        });
        let currencyBalance = currencyUser?.currency ?? 0;

    for (const { score, stars, coupon } of plannedChunks) {
      totalScore += score;
      const { next, granted } = cappedCurrencyIncrement(
        currencyBalance,
        stars.stars,
      );
      currencyBalance = next;
      totalStars += granted;
      responseEvents.push({ ...stars, stars: granted });
      if (granted > 0) {
        starInventoryRows.push({
          userId: session.user.id,
          gameId: "yanmar",
          type: "STAR",
          amount: granted,
          metadata: {
            score: stars.score,
            critical: stars.critical,
          },
        });
      }

      if (!coupon) continue;

      const allowed = await lockAndCanIssueYanmarCoupon(
        tx,
        coupon.couponType,
        seasonKey,
      );
      if (!allowed) continue;

      await tx.userCoupon.create({
        data: {
          userId: session.user.id,
          type: coupon.couponType,
          discountPct: coupon.discountPct,
          barcodeCode: coupon.barcodeCode,
          seasonKey: coupon.seasonKey,
          fromGameDrop: true,
          expiresAt: coupon.expiresAt,
        },
      });
      await tx.userRewardInventory.create({
        data: {
          userId: session.user.id,
          gameId: "yanmar",
          type: "COUPON",
          amount: coupon.discountPct,
          metadata: {
            couponType: coupon.couponType,
            barcodeCode: coupon.barcodeCode,
            score: coupon.score,
            critical: coupon.critical,
            seasonKey: coupon.seasonKey,
          },
        },
      });
      responseEvents.push({ ...coupon, score: 0 });
    }

    if (starInventoryRows.length > 0) {
      await tx.userRewardInventory.createMany({ data: starInventoryRows });
    }

    const gearDrops = [];
    let coresDropped = 0;
    let enhanceCoresTotal: number | undefined;
    for (let i = 0; i < safeChunkCount; i += 1) {
      const drop = await tryWorkGearDrop(tx, session.user.id, "soilDump");
      const payload = serializeWorkGearDrop(drop);
      if (payload) gearDrops.push(payload);
      const coreDrop = await tryWorkEnhanceCoresDrop(
        tx,
        session.user.id,
        "soilDump",
      );
      if (coreDrop.dropped) {
        coresDropped += coreDrop.amount;
        enhanceCoresTotal = coreDrop.enhanceCores;
      }
    }

    const updated = await tx.user.update({
      where: { id: session.user.id },
      data: {
        ...(totalStars > 0 ? { currency: currencyBalance } : {}),
        totalXp: { increment: xpGained },
      },
      select: { currency: true, totalXp: true, enhanceCores: true },
    });

        return {
          eventId,
          events: responseEvents.map((event) =>
            event.kind === "coupon"
              ? { ...event, expiresAt: event.expiresAt.toISOString() }
              : event,
          ),
          totalStars,
          totalScore,
          xpGained,
          currency: updated.currency,
          totalXp: updated.totalXp,
          enhanceCores: enhanceCoresTotal ?? updated.enhanceCores,
          coresDropped,
          stats,
          gearDrops,
        } as unknown as Prisma.InputJsonValue;
      },
    );
  });

  observation.setMetadata({
    outcome: "success",
    replayed: result.replayed,
  });

  if (!result.replayed) {
    const payload = result.result as {
      events?: DumpRewardEvent[];
    };
    const nickname = session.user.nickname ?? session.user.loginId;
    const tickerEvents = (payload.events ?? [])
      .filter((event): event is DumpCouponEvent => event.kind === "coupon")
      .map((event) => ({
        kind: "coupon" as const,
        nickname,
        message: formatTickerCouponMessage(
          nickname,
          event.couponType,
          event.discountPct,
        ),
      }));

    void publishTickerWinEvents(tickerEvents).catch((error) => {
      console.error("[ticker] dump publish failed:", error);
    });
  }

  return NextResponse.json(result.result);
  },
);