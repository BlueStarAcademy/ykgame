import type { CouponType, Prisma } from "@/generated/prisma/client";
import {
  canIssueSeasonGameDropCoupon,
  createBarcodeCode,
  getCouponExpiresAt,
} from "@/lib/coupon";
import { YANMAR_REWARD_CONFIG } from "@/games/yanmar/equipment";

const PARTS_DISCOUNTS = [10, 15, 20] as const;
const RENTAL_DISCOUNTS = [10, 20, 30] as const;
const EVENT_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export type YanmarStarReward = {
  kind: "stars";
  score: number;
  stars: number;
  critical: boolean;
};

export type YanmarCouponReward = {
  kind: "coupon";
  score: number;
  critical: boolean;
  couponType: CouponType;
  discountPct: number;
  barcodeCode: string;
  expiresAt: Date;
  seasonKey: string;
};

export type YanmarReward = YanmarStarReward | YanmarCouponReward;

type RewardMetadata = Record<
  string,
  boolean | number | string | null
>;

export function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export function parseRewardEventId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const eventId = value.trim();
  return EVENT_ID_PATTERN.test(eventId) ? eventId : null;
}

export function createYanmarStarReward(
  score: number,
  minStars: number,
  maxStars: number,
  critical = false,
): YanmarStarReward {
  return {
    kind: "stars",
    score,
    stars: randomInt(minStars, maxStars),
    critical,
  };
}

export function rollYanmarReward({
  score,
  minStars,
  maxStars,
  seasonKey,
  critical = false,
}: {
  score: number;
  minStars: number;
  maxStars: number;
  seasonKey: string;
  critical?: boolean;
}): YanmarReward {
  const roll = Math.random();
  const filterChance = YANMAR_REWARD_CONFIG.filterSetCouponChance;
  const partsChance = YANMAR_REWARD_CONFIG.partsCouponChance;
  const rentalChance = YANMAR_REWARD_CONFIG.rentalCouponChance;

  let couponType: CouponType | null = null;
  let discountPct = 0;

  if (roll < filterChance) {
    couponType = "FILTER_SET_EXCHANGE";
  } else if (roll < filterChance + partsChance) {
    couponType = "YK_PARTS_DISCOUNT";
    discountPct = pick(PARTS_DISCOUNTS);
  } else if (roll < filterChance + partsChance + rentalChance) {
    couponType = "EQUIPMENT_RENTAL_DISCOUNT";
    discountPct = pick(RENTAL_DISCOUNTS);
  }

  if (!couponType) {
    return createYanmarStarReward(score, minStars, maxStars, critical);
  }

  return {
    kind: "coupon",
    score,
    critical,
    couponType,
    discountPct,
    barcodeCode: createBarcodeCode(),
    expiresAt: getCouponExpiresAt(),
    seasonKey,
  };
}

export async function lockAndCheckRewardEvent(
  tx: Prisma.TransactionClient,
  userId: string,
  gameId: string,
  eventId: string,
) {
  const lockKey = `yanmar-reward:${userId}:${gameId}:${eventId}`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  const existing = await tx.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM "UserRewardInventory"
      WHERE "userId" = ${userId}
        AND "gameId" = ${gameId}
        AND "metadata"->>'eventId' = ${eventId}
    ) AS "exists"
  `;

  return existing[0]?.exists ?? false;
}

export async function isYanmarRewardRateLimited(
  tx: Prisma.TransactionClient,
  userId: string,
  gameId: string,
  minimumIntervalMs: number,
) {
  const lockKey = `yanmar-reward-rate:${userId}:${gameId}`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
  const latest = await tx.userRewardInventory.findFirst({
    where: { userId, gameId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return (
    latest != null &&
    Date.now() - latest.createdAt.getTime() < minimumIntervalMs
  );
}

export async function lockAndCanIssueYanmarCoupon(
  tx: Prisma.TransactionClient,
  couponType: CouponType,
  seasonKey: string,
) {
  const quotaLockKey = `yanmar-coupon:${seasonKey}:${couponType}`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${quotaLockKey}))`;
  return canIssueSeasonGameDropCoupon(tx, couponType, seasonKey);
}

export async function persistYanmarReward({
  tx,
  userId,
  gameId,
  reward,
  minStars,
  maxStars,
  metadata,
}: {
  tx: Prisma.TransactionClient;
  userId: string;
  gameId: string;
  reward: YanmarReward;
  minStars: number;
  maxStars: number;
  metadata: RewardMetadata;
}): Promise<YanmarReward> {
  let issuedReward = reward;
  let fallbackFromCoupon = false;

  if (issuedReward.kind === "coupon") {
    const allowed = await lockAndCanIssueYanmarCoupon(
      tx,
      issuedReward.couponType,
      issuedReward.seasonKey,
    );
    if (!allowed) {
      fallbackFromCoupon = true;
      issuedReward = createYanmarStarReward(
        issuedReward.score,
        minStars,
        maxStars,
        issuedReward.critical,
      );
    }
  }

  if (issuedReward.kind === "coupon") {
    await tx.userCoupon.create({
      data: {
        userId,
        type: issuedReward.couponType,
        discountPct: issuedReward.discountPct,
        barcodeCode: issuedReward.barcodeCode,
        seasonKey: issuedReward.seasonKey,
        fromGameDrop: true,
        expiresAt: issuedReward.expiresAt,
      },
    });
    await tx.userRewardInventory.create({
      data: {
        userId,
        gameId,
        type: "COUPON",
        amount: issuedReward.discountPct,
        metadata: {
          ...metadata,
          score: issuedReward.score,
          critical: issuedReward.critical,
          couponType: issuedReward.couponType,
          barcodeCode: issuedReward.barcodeCode,
          seasonKey: issuedReward.seasonKey,
        },
      },
    });
    return issuedReward;
  }

  await tx.userRewardInventory.create({
    data: {
      userId,
      gameId,
      type: "STAR",
      amount: issuedReward.stars,
      metadata: {
        ...metadata,
        score: issuedReward.score,
        critical: issuedReward.critical,
        ...(fallbackFromCoupon ? { fallbackFromCoupon: true } : {}),
      },
    },
  });
  return issuedReward;
}
