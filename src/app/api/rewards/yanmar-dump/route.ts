import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canIssueSeasonGameDropCoupon,
  createBarcodeCode,
  getCouponExpiresAt,
} from "@/lib/coupon";
import { getSeasonKey } from "@/lib/games";
import {
  mergeYanmarEquipmentLevelsFromDb,
  YANMAR_REWARD_CONFIG,
  calculateYanmarEquipmentStats,
  calculateYanmarChunkScore,
} from "@/games/yanmar/equipment";
import type { CouponType } from "@/generated/prisma/client";

const PARTS_DISCOUNTS = [10, 15, 20] as const;
const RENTAL_DISCOUNTS = [10, 20, 30] as const;

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

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function createStarEvent(score: number, critical: boolean): DumpStarEvent {
  return {
    kind: "stars",
    score,
    critical,
    stars: randomInt(
      YANMAR_REWARD_CONFIG.minStarReward,
      YANMAR_REWARD_CONFIG.maxStarReward,
    ),
  };
}

function rollRewardEvent(
  score: number,
  critical: boolean,
  remaining: { parts: number; rental: number; filterSet: number },
  seasonKey: string,
): DumpRewardEvent {
  const roll = Math.random();
  const filterChance = YANMAR_REWARD_CONFIG.filterSetCouponChance;
  const partsChance = YANMAR_REWARD_CONFIG.partsCouponChance;
  const rentalChance = YANMAR_REWARD_CONFIG.rentalCouponChance;

  // 희귀 쿠폰을 먼저 판정 (0.0001%)
  if (roll < filterChance) {
    if (remaining.filterSet <= 0) return createStarEvent(score, critical);
    remaining.filterSet -= 1;
    return {
      kind: "coupon",
      score,
      critical,
      couponType: "FILTER_SET_EXCHANGE",
      discountPct: 0,
      barcodeCode: createBarcodeCode(),
      expiresAt: getCouponExpiresAt(),
      seasonKey,
    };
  }

  if (roll < filterChance + partsChance) {
    if (remaining.parts <= 0) return createStarEvent(score, critical);
    remaining.parts -= 1;
    return {
      kind: "coupon",
      score,
      critical,
      couponType: "YK_PARTS_DISCOUNT",
      discountPct: pick(PARTS_DISCOUNTS),
      barcodeCode: createBarcodeCode(),
      expiresAt: getCouponExpiresAt(),
      seasonKey,
    };
  }

  if (roll < filterChance + partsChance + rentalChance) {
    if (remaining.rental <= 0) return createStarEvent(score, critical);
    remaining.rental -= 1;
    return {
      kind: "coupon",
      score,
      critical,
      couponType: "EQUIPMENT_RENTAL_DISCOUNT",
      discountPct: pick(RENTAL_DISCOUNTS),
      barcodeCode: createBarcodeCode(),
      expiresAt: getCouponExpiresAt(),
      seasonKey,
    };
  }

  return createStarEvent(score, critical);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chunkCount } = (await request.json()) as { chunkCount?: unknown };
  const safeChunkCount =
    typeof chunkCount === "number"
      ? Math.max(1, Math.min(10, Math.floor(chunkCount)))
      : 1;

  const rows = await prisma.userEquipmentUpgrade.findMany({
    where: { userId: session.user.id, gameId: "yanmar" },
    select: { part: true, level: true },
  });
  const levels = mergeYanmarEquipmentLevelsFromDb(rows);
  const stats = calculateYanmarEquipmentStats(levels);
  const seasonKey = getSeasonKey();

  const [partsIssued, rentalIssued, filterSetIssued] = await Promise.all([
    prisma.userCoupon.count({
      where: {
        type: "YK_PARTS_DISCOUNT",
        seasonKey,
        fromGameDrop: true,
      },
    }),
    prisma.userCoupon.count({
      where: {
        type: "EQUIPMENT_RENTAL_DISCOUNT",
        seasonKey,
        fromGameDrop: true,
      },
    }),
    prisma.userCoupon.count({
      where: {
        type: "FILTER_SET_EXCHANGE",
        seasonKey,
        fromGameDrop: true,
      },
    }),
  ]);

  const remaining = {
    parts: Math.max(0, YANMAR_REWARD_CONFIG.partsCouponSeasonLimit - partsIssued),
    rental: Math.max(
      0,
      YANMAR_REWARD_CONFIG.rentalCouponSeasonLimit - rentalIssued,
    ),
    filterSet: Math.max(
      0,
      YANMAR_REWARD_CONFIG.filterSetCouponSeasonLimit - filterSetIssued,
    ),
  };

  const plannedEvents = Array.from({ length: safeChunkCount }, () => {
    const critical = Math.random() < stats.criticalChance;
    const score = calculateYanmarChunkScore(stats, critical);
    return rollRewardEvent(score, critical, remaining, seasonKey);
  });

  /** 1 dump score chunk ≈ scoreChunkUnits of soil → same amount of lifetime XP */
  const xpGained = stats.scoreChunkUnits * safeChunkCount;

  const result = await prisma.$transaction(async (tx) => {
    const responseEvents: DumpRewardEvent[] = [];
    let totalStars = 0;
    let totalScore = 0;

    for (const planned of plannedEvents) {
      totalScore += planned.score;

      if (planned.kind === "coupon") {
        const allowed = await canIssueSeasonGameDropCoupon(
          tx,
          planned.couponType,
          seasonKey,
        );
        if (!allowed) {
          const fallback = createStarEvent(planned.score, planned.critical);
          totalStars += fallback.stars;
          responseEvents.push(fallback);
          await tx.userRewardInventory.create({
            data: {
              userId: session.user.id,
              gameId: "yanmar",
              type: "STAR",
              amount: fallback.stars,
              metadata: {
                score: planned.score,
                critical: planned.critical,
                fallbackFromCoupon: true,
              },
            },
          });
          continue;
        }

        await tx.userCoupon.create({
          data: {
            userId: session.user.id,
            type: planned.couponType,
            discountPct: planned.discountPct,
            barcodeCode: planned.barcodeCode,
            seasonKey: planned.seasonKey,
            fromGameDrop: true,
            expiresAt: planned.expiresAt,
          },
        });
        await tx.userRewardInventory.create({
          data: {
            userId: session.user.id,
            gameId: "yanmar",
            type: "COUPON",
            amount: planned.discountPct,
            metadata: {
              couponType: planned.couponType,
              barcodeCode: planned.barcodeCode,
              score: planned.score,
              critical: planned.critical,
              seasonKey: planned.seasonKey,
            },
          },
        });
        responseEvents.push(planned);
      } else {
        totalStars += planned.stars;
        responseEvents.push(planned);
        await tx.userRewardInventory.create({
          data: {
            userId: session.user.id,
            gameId: "yanmar",
            type: "STAR",
            amount: planned.stars,
            metadata: {
              score: planned.score,
              critical: planned.critical,
            },
          },
        });
      }
    }

    const updated = await tx.user.update({
      where: { id: session.user.id },
      data: {
        ...(totalStars > 0 ? { currency: { increment: totalStars } } : {}),
        totalXp: { increment: xpGained },
      },
      select: { currency: true, totalXp: true },
    });

    return {
      events: responseEvents,
      totalStars,
      totalScore,
      currency: updated.currency,
      totalXp: updated.totalXp,
    };
  });

  return NextResponse.json({
    events: result.events,
    totalStars: result.totalStars,
    totalScore: result.totalScore,
    xpGained,
    currency: result.currency,
    totalXp: result.totalXp,
    stats,
  });
}
