import type { CouponType, Prisma } from "@/generated/prisma/client";
import {
  canIssueSeasonGameDropCoupon,
  createBarcodeCode,
  getCouponExpiresAt,
} from "@/lib/coupon";
import { YANMAR_REWARD_CONFIG } from "@/games/yanmar/equipment";
export { parseRewardEventId } from "@/lib/request-idempotency";

const PARTS_DISCOUNTS = [10, 15, 20] as const;
const RENTAL_DISCOUNTS = [10, 20, 30] as const;

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

export type YanmarCouponRemaining = {
  parts: number;
  rental: number;
  filterSet: number;
};

export type YanmarDropRoll = {
  stars: YanmarStarReward;
  coupon: YanmarCouponReward | null;
};

type RewardMetadata = Record<
  string,
  boolean | number | string | null
>;

const COUPON_TYPES = [
  "FILTER_SET_EXCHANGE",
  "YK_PARTS_DISCOUNT",
  "EQUIPMENT_RENTAL_DISCOUNT",
] as const satisfies readonly CouponType[];

export function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
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

function couponDiscountPct(couponType: CouponType): number {
  if (couponType === "YK_PARTS_DISCOUNT") return pick(PARTS_DISCOUNTS);
  if (couponType === "EQUIPMENT_RENTAL_DISCOUNT") return pick(RENTAL_DISCOUNTS);
  return 0;
}

function remainingForType(
  couponType: CouponType,
  remaining: YanmarCouponRemaining | undefined,
): number {
  if (!remaining) return 1;
  if (couponType === "FILTER_SET_EXCHANGE") return remaining.filterSet;
  if (couponType === "YK_PARTS_DISCOUNT") return remaining.parts;
  return remaining.rental;
}

function consumeRemaining(
  couponType: CouponType,
  remaining: YanmarCouponRemaining | undefined,
) {
  if (!remaining) return;
  if (couponType === "FILTER_SET_EXCHANGE") remaining.filterSet -= 1;
  else if (couponType === "YK_PARTS_DISCOUNT") remaining.parts -= 1;
  else remaining.rental -= 1;
}

/** Pick among available types by relative weights. */
export function pickYanmarCouponType(
  available: readonly CouponType[],
): CouponType | null {
  if (available.length === 0) return null;
  const weights = YANMAR_REWARD_CONFIG.couponTypeWeights;
  const entries = available.map((type) => ({
    type,
    weight: Math.max(0, weights[type] ?? 0),
  }));
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  if (total <= 0) {
    return available[Math.floor(Math.random() * available.length)] ?? null;
  }
  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.type;
  }
  return entries[entries.length - 1]?.type ?? null;
}

export function rollYanmarCouponDrop({
  score,
  critical = false,
  seasonKey,
  remaining,
}: {
  score: number;
  critical?: boolean;
  seasonKey: string;
  remaining?: YanmarCouponRemaining;
}): YanmarCouponReward | null {
  if (Math.random() >= YANMAR_REWARD_CONFIG.couponDropChance) return null;

  const available = COUPON_TYPES.filter(
    (type) => remainingForType(type, remaining) > 0,
  );
  const couponType = pickYanmarCouponType(available);
  if (!couponType) return null;

  consumeRemaining(couponType, remaining);

  return {
    kind: "coupon",
    score,
    critical,
    couponType,
    discountPct: couponDiscountPct(couponType),
    barcodeCode: createBarcodeCode(),
    expiresAt: getCouponExpiresAt(),
    seasonKey,
  };
}

/** Stars always; coupon optional additional drop. */
export function rollYanmarDropRewards({
  score,
  minStars,
  maxStars,
  seasonKey,
  critical = false,
  remaining,
}: {
  score: number;
  minStars: number;
  maxStars: number;
  seasonKey: string;
  critical?: boolean;
  remaining?: YanmarCouponRemaining;
}): YanmarDropRoll {
  return {
    stars: createYanmarStarReward(score, minStars, maxStars, critical),
    coupon: rollYanmarCouponDrop({ score, critical, seasonKey, remaining }),
  };
}

export async function runReplayableRewardEvent<
  T extends Prisma.InputJsonValue,
>(
  tx: Prisma.TransactionClient,
  {
    userId,
    gameId,
    eventId,
  }: {
    userId: string;
    gameId: string;
    eventId: string;
  },
  issue: () => Promise<T>,
): Promise<{ result: T; replayed: boolean }> {
  const lockKey = `yanmar-reward:${userId}:${gameId}:${eventId}`;
  // Transaction-scoped locks are safe with PgBouncer transaction pooling.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  const existing = await tx.rewardEvent.findUnique({
    where: { userId_gameId_eventId: { userId, gameId, eventId } },
    select: { result: true },
  });
  if (existing) {
    return { result: existing.result as T, replayed: true };
  }

  const result = await issue();
  await tx.rewardEvent.create({
    data: { userId, gameId, eventId, result },
  });
  return { result, replayed: false };
}

export async function isYanmarRewardRateLimited(
  tx: Prisma.TransactionClient,
  userId: string,
  gameId: string,
  minimumIntervalMs: number,
) {
  const lockKey = `yanmar-reward-rate:${userId}:${gameId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
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
  // The season quota lock is also transaction-scoped; never use session locks.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${quotaLockKey}))`;
  return canIssueSeasonGameDropCoupon(tx, couponType, seasonKey);
}

export async function persistYanmarDropRewards({
  tx,
  userId,
  gameId,
  stars,
  coupon,
  metadata,
}: {
  tx: Prisma.TransactionClient;
  userId: string;
  gameId: string;
  stars: YanmarStarReward;
  coupon: YanmarCouponReward | null;
  metadata: RewardMetadata;
}): Promise<YanmarDropRoll> {
  let issuedCoupon: YanmarCouponReward | null = null;

  if (coupon) {
    const allowed = await lockAndCanIssueYanmarCoupon(
      tx,
      coupon.couponType,
      coupon.seasonKey,
    );
    if (allowed) {
      await tx.userCoupon.create({
        data: {
          userId,
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
          userId,
          gameId,
          type: "COUPON",
          amount: coupon.discountPct,
          metadata: {
            ...metadata,
            score: coupon.score,
            critical: coupon.critical,
            couponType: coupon.couponType,
            barcodeCode: coupon.barcodeCode,
            seasonKey: coupon.seasonKey,
          },
        },
      });
      issuedCoupon = coupon;
    }
  }

  await tx.userRewardInventory.create({
    data: {
      userId,
      gameId,
      type: "STAR",
      amount: stars.stars,
      metadata: {
        ...metadata,
        score: stars.score,
        critical: stars.critical,
      },
    },
  });

  return { stars, coupon: issuedCoupon };
}