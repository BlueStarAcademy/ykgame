export type MonumentPhase =
  | "locked"
  | "quest"
  | "building"
  | "claimable"
  | "active";

export type MonumentUpgradeKey = "storage_cap" | "prod_speed";

export type MonumentQuestMetric =
  | "soilDump"
  | "dumpTruckDepart"
  | "asphaltBreak"
  | "haulTruckDepart"
  | "rockDump"
  | "travel";

export interface MonumentUpgradeDef {
  key: MonumentUpgradeKey;
  label: string;
  description: string;
  maxLevel: 10;
}

export interface MonumentQuestDef {
  id: string;
  title: string;
  metric: MonumentQuestMetric;
  target: number;
  rewardPoints: number;
  kind: "daily";
}

export interface MonumentBuildQuestDef {
  id: string;
  title: string;
  metric: MonumentQuestMetric;
  target: number;
}

export const MONUMENT_UNLOCK_LEVEL = 20;
export const MONUMENT_CONSTRUCTION_MS = 60 * 60_000;
export const MONUMENT_BASE_STORAGE = 100;
export const MONUMENT_BASE_INTERVAL_MS = 20 * 60_000;
export const MONUMENT_MIN_INTERVAL_MS = 60_000;
/** Stars granted per completed production interval. */
export const MONUMENT_STARS_PER_TICK = 10;

/** Per-level storage capacity bonuses (index 0 = +1). */
export const MONUMENT_STORAGE_BONUS = [
  20, 20, 20, 30, 30, 30, 40, 40, 40, 70,
] as const;

/** Per-level production interval reduction in seconds (index 0 = +1). */
export const MONUMENT_SPEED_REDUCTION_SEC = [
  20, 20, 20, 40, 40, 40, 60, 60, 60, 120,
] as const;
