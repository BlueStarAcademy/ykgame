import { randomUUID } from "crypto";
import type { CouponType, Prisma, PrismaClient } from "@/generated/prisma/client";
import { YANMAR_REWARD_CONFIG } from "@/games/yanmar/equipment";
import { getSeasonKey } from "@/lib/games";

type TxClient = Prisma.TransactionClient;
type DbClient = PrismaClient | TxClient;

export function createBarcodeCode() {
  return `YK-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
}

export function getCouponExpiresAt(from = new Date()) {
  const expiresAt = new Date(from);
  expiresAt.setDate(expiresAt.getDate() + YANMAR_REWARD_CONFIG.couponExpiresInDays);
  return expiresAt;
}

export function getSeasonCouponLimit(type: CouponType): number {
  return type === "YK_PARTS_DISCOUNT"
    ? YANMAR_REWARD_CONFIG.partsCouponSeasonLimit
    : YANMAR_REWARD_CONFIG.rentalCouponSeasonLimit;
}

export async function countSeasonGameDropCoupons(
  db: DbClient,
  type: CouponType,
  seasonKey = getSeasonKey(),
) {
  return db.userCoupon.count({
    where: {
      type,
      seasonKey,
      fromGameDrop: true,
    },
  });
}

export async function getSeasonCouponQuota(
  db: DbClient,
  type: CouponType,
  seasonKey = getSeasonKey(),
) {
  const limit = getSeasonCouponLimit(type);
  const issued = await countSeasonGameDropCoupons(db, type, seasonKey);
  return {
    type,
    seasonKey,
    limit,
    issued,
    remaining: Math.max(0, limit - issued),
  };
}

export async function canIssueSeasonGameDropCoupon(
  db: DbClient,
  type: CouponType,
  seasonKey = getSeasonKey(),
) {
  const quota = await getSeasonCouponQuota(db, type, seasonKey);
  return quota.remaining > 0;
}

export function couponTypeLabel(type: CouponType) {
  return type === "YK_PARTS_DISCOUNT"
    ? "YK건기 부품 할인권"
    : "중장비 대여 할인권";
}
