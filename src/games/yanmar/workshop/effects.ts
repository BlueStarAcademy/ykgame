import {
  getYanmarHaulTruckCooldownSec,
  getYanmarTruckCapacityUnits,
  getYanmarTruckCooldownSec,
  YANMAR_BASE_HAUL_TRUCK_CAPACITY,
  YANMAR_BASE_HILL_BOULDER_COUNT,
} from "../equipment";
import type { WorkshopId, WorkshopUpgradeKey } from "./types";

export type WorkshopUpgradeLevels = Partial<Record<WorkshopUpgradeKey, number>>;

export type WorkshopLevelsById = Record<WorkshopId, WorkshopUpgradeLevels>;

export function emptyWorkshopLevelsById(): WorkshopLevelsById {
  return { dump: {}, crash: {}, hill: {} };
}

export function levelsByWorkshopFromRows(
  rows: { workshopId: string; upgradeKey: string; level: number }[],
): WorkshopLevelsById {
  const out = emptyWorkshopLevelsById();
  for (const row of rows) {
    if (
      row.workshopId !== "dump" &&
      row.workshopId !== "crash" &&
      row.workshopId !== "hill"
    ) {
      continue;
    }
    const level = Math.max(0, Math.floor(row.level));
    out[row.workshopId][row.upgradeKey as WorkshopUpgradeKey] = level;
  }
  return out;
}

/** Flat merge for truck/breaker stats that use unique keys across workshops. */
export function flattenWorkshopLevels(
  byId: WorkshopLevelsById,
): WorkshopUpgradeLevels {
  return {
    ...byId.dump,
    ...byId.crash,
    ...byId.hill,
  };
}

export function workshopScoreMult(level = 0) {
  return 1 + Math.max(0, Math.floor(level)) * 0.1;
}

export function workshopXpMult(level = 0) {
  return 1 + Math.max(0, Math.floor(level)) * 0.05;
}

/** Additive percentage points (0.01 per level). */
export function workshopLuckyDropBonus(level = 0) {
  return Math.max(0, Math.floor(level)) * 0.01;
}

export function workshopBreakerPowerMult(level = 0) {
  return 1 + Math.max(0, Math.floor(level)) * 0.1;
}

export function workshopHillBoulderCount(rockAppraiserLevel = 0) {
  return (
    YANMAR_BASE_HILL_BOULDER_COUNT +
    Math.max(0, Math.min(5, Math.floor(rockAppraiserLevel)))
  );
}

export function workshopHaulTruckCapacity(haulCapacityLevel = 0) {
  return (
    YANMAR_BASE_HAUL_TRUCK_CAPACITY +
    Math.max(0, Math.min(10, Math.floor(haulCapacityLevel)))
  );
}

export function applyWorkshopTruckStats(levels: WorkshopUpgradeLevels) {
  const truckCap = levels.truck_capacity ?? 0;
  const truckCd = levels.truck_cooldown ?? 0;
  const haulCap = levels.haul_capacity ?? 0;
  const haulCd = levels.haul_cooldown ?? 0;
  const breakerPower = levels.breaker_power ?? 0;
  const rockAppraiser = levels.rock_appraiser ?? 0;

  return {
    truckCapacityUnits: getYanmarTruckCapacityUnits(truckCap),
    truckCooldownSec: getYanmarTruckCooldownSec(truckCd),
    haulTruckCapacity: workshopHaulTruckCapacity(haulCap),
    haulTruckCooldownSec: getYanmarHaulTruckCooldownSec(haulCd),
    hillBoulderCount: workshopHillBoulderCount(rockAppraiser),
    breakerPowerMult: workshopBreakerPowerMult(breakerPower),
  };
}
