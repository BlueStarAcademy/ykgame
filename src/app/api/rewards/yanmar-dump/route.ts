import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  mergeYanmarEquipmentLevelsFromDb,
  YANMAR_REWARD_CONFIG,
  calculateYanmarEquipmentStats,
  calculateYanmarChunkScore,
} from "@/games/yanmar/equipment";

const PARTS_DISCOUNTS = [10, 15, 20] as const;
const RENTAL_DISCOUNTS = [10, 20, 30] as const;

type DumpRewardEvent =
  | {
      kind: "coupon";
      score: number;
      critical: boolean;
      couponType: "YK_PARTS_DISCOUNT" | "EQUIPMENT_RENTAL_DISCOUNT";
      discountPct: number;
      barcodeCode: string;
      expiresAt: Date;
    }
  | {
      kind: "stars";
      score: number;
      critical: boolean;
      stars: number;
    };

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function createBarcodeCode() {
  return `YK-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
}

function createRewardEvent(score: number, critical: boolean): DumpRewardEvent {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + YANMAR_REWARD_CONFIG.couponExpiresInDays);

  const roll = Math.random();
  if (roll < YANMAR_REWARD_CONFIG.partsCouponChance) {
    return {
      kind: "coupon",
      score,
      critical,
      couponType: "YK_PARTS_DISCOUNT",
      discountPct: pick(PARTS_DISCOUNTS),
      barcodeCode: createBarcodeCode(),
      expiresAt,
    };
  }

  if (
    roll <
    YANMAR_REWARD_CONFIG.partsCouponChance +
      YANMAR_REWARD_CONFIG.rentalCouponChance
  ) {
    return {
      kind: "coupon",
      score,
      critical,
      couponType: "EQUIPMENT_RENTAL_DISCOUNT",
      discountPct: pick(RENTAL_DISCOUNTS),
      barcodeCode: createBarcodeCode(),
      expiresAt,
    };
  }

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

  const events = Array.from({ length: safeChunkCount }, () => {
    const critical = Math.random() < stats.criticalChance;
    const score = calculateYanmarChunkScore(stats, critical);
    return createRewardEvent(score, critical);
  });

  const totalStars = events.reduce(
    (sum, event) => sum + (event.kind === "stars" ? event.stars : 0),
    0,
  );
  const totalScore = events.reduce((sum, event) => sum + event.score, 0);

  const result = await prisma.$transaction(async (tx) => {
    if (totalStars > 0) {
      await tx.user.update({
        where: { id: session.user.id },
        data: { currency: { increment: totalStars } },
      });
    }

    for (const event of events) {
      if (event.kind === "coupon") {
        await tx.userCoupon.create({
          data: {
            userId: session.user.id,
            type: event.couponType,
            discountPct: event.discountPct,
            barcodeCode: event.barcodeCode,
            expiresAt: event.expiresAt,
          },
        });
        await tx.userRewardInventory.create({
          data: {
            userId: session.user.id,
            gameId: "yanmar",
            type: "COUPON",
            amount: event.discountPct,
            metadata: {
              couponType: event.couponType,
              barcodeCode: event.barcodeCode,
              score: event.score,
              critical: event.critical,
            },
          },
        });
      } else {
        await tx.userRewardInventory.create({
          data: {
            userId: session.user.id,
            gameId: "yanmar",
            type: "STAR",
            amount: event.stars,
            metadata: {
              score: event.score,
              critical: event.critical,
            },
          },
        });
      }
    }

    const user = await tx.user.findUnique({
      where: { id: session.user.id },
      select: { currency: true },
    });
    return { currency: user?.currency ?? 0 };
  });

  return NextResponse.json({
    events,
    totalStars,
    totalScore,
    currency: result.currency,
    stats,
  });
}
