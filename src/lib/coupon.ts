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
  switch (type) {
    case "YK_PARTS_DISCOUNT":
      return YANMAR_REWARD_CONFIG.partsCouponSeasonLimit;
    case "EQUIPMENT_RENTAL_DISCOUNT":
      return YANMAR_REWARD_CONFIG.rentalCouponSeasonLimit;
    case "FILTER_SET_EXCHANGE":
      return YANMAR_REWARD_CONFIG.filterSetCouponSeasonLimit;
    default:
      return 0;
  }
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
  switch (type) {
    case "YK_PARTS_DISCOUNT":
      return "YK건기 부품 할인권";
    case "EQUIPMENT_RENTAL_DISCOUNT":
      return "중장비 대여 할인권";
    case "FILTER_SET_EXCHANGE":
      return "필터세트 교환쿠폰";
    default:
      return type;
  }
}

/** 교환권 등 할인율이 없는 쿠폰 */
export function isExchangeCoupon(type: CouponType) {
  return type === "FILTER_SET_EXCHANGE";
}
