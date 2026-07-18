import { randomUUID } from "crypto";
import type { CouponType, Prisma, PrismaClient } from "@/generated/prisma/client";
import { YANMAR_REWARD_CONFIG } from "@/games/yanmar/equipment";
import { getSeasonKey } from "@/lib/games";
import { deleteRedisKeys, readRedisJson, writeRedisJson } from "@/lib/redis-cache";
import { getRedisConfig } from "@/lib/redis-config";
import { seasonDropCouponsKey } from "@/lib/redis-keys";
import { createTtlCache } from "@/lib/ttl-cache";

type TxClient = Prisma.TransactionClient;
type DbClient = PrismaClient | TxClient;

const SEASON_DROP_COUPON_TYPES = [
  "YK_PARTS_DISCOUNT",
  "EQUIPMENT_RENTAL_DISCOUNT",
  "FILTER_SET_EXCHANGE",
] as const satisfies readonly CouponType[];

type SeasonDropIssuedMap = Record<(typeof SEASON_DROP_COUPON_TYPES)[number], number>;

const SEASON_DROP_CACHE_TTL_MS = 5_000;
const SEASON_DROP_CACHE_TTL_SECONDS = 5;

/** Pre-roll quota peek only — authoritative checks still use advisory locks. */
const seasonDropIssuedCache = createTtlCache<SeasonDropIssuedMap>(
  SEASON_DROP_CACHE_TTL_MS,
);

function isSeasonDropIssuedMap(value: unknown): value is SeasonDropIssuedMap {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return SEASON_DROP_COUPON_TYPES.every(
    (type) =>
      typeof record[type] === "number" &&
      Number.isInteger(record[type]) &&
      (record[type] as number) >= 0,
  );
}

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

export async function countSeasonGameDropCouponsGrouped(
  db: DbClient,
  seasonKey = getSeasonKey(),
  options?: { bypassCache?: boolean },
): Promise<SeasonDropIssuedMap> {
  const empty: SeasonDropIssuedMap = {
    YK_PARTS_DISCOUNT: 0,
    EQUIPMENT_RENTAL_DISCOUNT: 0,
    FILTER_SET_EXCHANGE: 0,
  };

  const config = getRedisConfig();
  const sharedKey = seasonDropCouponsKey(config.prefix, seasonKey);

  if (!options?.bypassCache) {
    const shared = await readRedisJson(sharedKey, isSeasonDropIssuedMap);
    if (shared.available && shared.hit) return { ...shared.value };
    if (!shared.available) {
      const cached = seasonDropIssuedCache.get(seasonKey);
      if (cached) return { ...cached };
    }
  }

  const rows = await db.userCoupon.groupBy({
    by: ["type"],
    where: {
      seasonKey,
      fromGameDrop: true,
      type: { in: [...SEASON_DROP_COUPON_TYPES] },
    },
    _count: { _all: true },
  });

  const issued = { ...empty };
  for (const row of rows) {
    if (row.type in issued) {
      issued[row.type as keyof SeasonDropIssuedMap] = row._count._all;
    }
  }

  seasonDropIssuedCache.set(seasonKey, issued);
  if (config.enabled) {
    await writeRedisJson(sharedKey, issued, SEASON_DROP_CACHE_TTL_SECONDS);
  }
  return issued;
}

/** Drop shared pre-roll cache after a game-drop coupon may have been issued. */
export async function invalidateSeasonDropCouponCache(
  seasonKey = getSeasonKey(),
): Promise<void> {
  seasonDropIssuedCache.delete(seasonKey);
  const config = getRedisConfig();
  if (!config.enabled) return;
  await deleteRedisKeys(seasonDropCouponsKey(config.prefix, seasonKey));
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
