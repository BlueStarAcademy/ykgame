import type { YanmarEquipmentStats } from "./equipment";
import type { ShopItemId } from "./shopCatalog";
import type { ActiveShopBuff } from "./shopBuffPersistence";

/** Derive active buff ids (already pruned preferred). */
export function activeShopBuffIds(
  buffs: ActiveShopBuff[],
  now = Date.now(),
): ShopItemId[] {
  return buffs.filter((b) => b.expiresAt > now).map((b) => b.id);
}

/**
 * Apply timed shop consumable buffs onto runtime gear stats.
 * Mutates a shallow copy; caller should pass base (gear+chassis) stats.
 */
export function applyShopBuffsToStats<T extends YanmarEquipmentStats>(
  stats: T,
  buffIds: readonly ShopItemId[],
): T {
  if (buffIds.length === 0) return stats;
  const next = { ...stats };
  const has = (id: ShopItemId) => buffIds.includes(id);

  if (has("cylinder-oil-arm")) {
    next.criticalChance = Math.min(0.95, next.criticalChance * 1.25);
  }
  if (has("cylinder-oil-boom")) {
    next.criticalMultiplier = next.criticalMultiplier * 1.5;
  }
  if (has("engine-fluorine-clean")) {
    next.travelSpeedMultiplier = next.travelSpeedMultiplier * 1.5;
  }
  if (has("rock-load-manual")) {
    next.gripAdhesionBonus = next.gripAdhesionBonus + 0.2;
    next.hillSafeLoadChance = Math.min(1, next.hillSafeLoadChance + 0.1);
  }
  if (has("truck-racer")) {
    next.truckCooldownSec = Math.max(30, next.truckCooldownSec - 60);
    next.haulTruckCooldownSec = Math.max(30, next.haulTruckCooldownSec - 60);
  }
  return next;
}

/** 랭커의의지: 점수 2배 확률 35% */
export function applyRankerWillScore(
  score: number,
  buffIds: readonly ShopItemId[],
): number {
  if (!buffIds.includes("ranker-will") || score <= 0) return score;
  if (Math.random() >= 0.35) return score;
  return score * 2;
}
