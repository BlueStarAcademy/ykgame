import type { ChassisBaseStats } from "../chassisCatalog";
import { PLAYER_UNLOCKS } from "@/lib/playerUnlocks";

/** Player level required to unlock flood recovery content. */
export const FLOOD_RECOVERY_UNLOCK_LEVEL = PLAYER_UNLOCKS.FLOOD_RECOVERY;

/** Default incinerator fill target before burn (before capacity upgrades). */
export const FLOOD_INCINERATOR_BASE_CAPACITY = 3000;

/** Collection pad fill needed before grapple pickup is allowed. */
export const FLOOD_COLLECTION_THRESHOLD = 500;

/** Base blade push amount for a valid straight push stroke. */
export const FLOOD_BASE_PUSH_UNITS = 500;

/** Grapple deposit chunk size into incinerator (matches collection threshold). */
export const FLOOD_GRAPPLE_CHUNK = 500;

export const FLOOD_ZONE_RESPAWN_MS = 5 * 60 * 1000;

/** Base burn FX duration (seconds) before incinerator_power upgrades. */
export const FLOOD_BASE_BURN_SEC = 8;

/** Minimum burn FX duration so upgrades never skip the animation. */
export const FLOOD_MIN_BURN_SEC = 3;

/** Safety radius around incinerator — player must leave before burn starts. */
export const FLOOD_INCINERATOR_SAFE_RADIUS = 10;

/** Per-ability weights applied to chassis-stat deltas vs base chassis. */
export const FLOOD_PUSH_STAT_WEIGHTS = {
  strength: 0.008,
  agility: 0.004,
  stamina: 0.003,
  endurance: 0.003,
  balance: 0.005,
  technique: 0.005,
} as const satisfies Record<keyof ChassisBaseStats, number>;

/** cleaning_master: +5% push per level, max 10. */
export const FLOOD_CLEANING_MASTER_BONUS_PER_LEVEL = 0.05;
export const FLOOD_CLEANING_MASTER_MAX_LEVEL = 10;

/** incinerator_power: -5% burn time per level, max 10. */
export const FLOOD_INCINERATOR_POWER_REDUCTION_PER_LEVEL = 0.05;
export const FLOOD_INCINERATOR_POWER_MAX_LEVEL = 10;

/** incinerator_capacity: +500 total per level, max 5. */
export const FLOOD_INCINERATOR_CAPACITY_PER_LEVEL = 500;
export const FLOOD_INCINERATOR_CAPACITY_MAX_LEVEL = 5;

export const YANMAR_FLOOD_REWARD_CONFIG = {
  collect: {
    baseScoreMin: 400,
    baseScoreMax: 500,
    minStarReward: 8,
    maxStarReward: 15,
    xpMin: 800,
    xpMax: 1000,
  },
  grapple: {
    baseScoreMin: 500,
    baseScoreMax: 600,
    minStarReward: 10,
    maxStarReward: 18,
    xpMin: 1000,
    xpMax: 1200,
  },
  burn: {
    baseScoreMin: 2000,
    baseScoreMax: 2500,
    minStarReward: 30,
    maxStarReward: 50,
    xpMin: 3000,
    xpMax: 4000,
  },
} as const;

export type FloodRewardKind = keyof typeof YANMAR_FLOOD_REWARD_CONFIG;

export function floodIncineratorCapacity(capacityLevel = 0): number {
  const level = Math.max(
    0,
    Math.min(FLOOD_INCINERATOR_CAPACITY_MAX_LEVEL, Math.floor(capacityLevel)),
  );
  return (
    FLOOD_INCINERATOR_BASE_CAPACITY +
    level * FLOOD_INCINERATOR_CAPACITY_PER_LEVEL
  );
}

export function floodBurnDurationSec(powerLevel = 0): number {
  const level = Math.max(
    0,
    Math.min(FLOOD_INCINERATOR_POWER_MAX_LEVEL, Math.floor(powerLevel)),
  );
  const scaled =
    FLOOD_BASE_BURN_SEC *
    (1 - level * FLOOD_INCINERATOR_POWER_REDUCTION_PER_LEVEL);
  return Math.max(FLOOD_MIN_BURN_SEC, scaled);
}

export function floodCleaningMasterMult(cleaningMasterLevel = 0): number {
  const level = Math.max(
    0,
    Math.min(FLOOD_CLEANING_MASTER_MAX_LEVEL, Math.floor(cleaningMasterLevel)),
  );
  return 1 + level * FLOOD_CLEANING_MASTER_BONUS_PER_LEVEL;
}

/**
 * Blade push units for one valid straight stroke.
 * Uses final chassis stats minus base chassis so a stock machine stays at 500.
 */
export function calculateFloodPushUnits(input: {
  chassisStats: ChassisBaseStats;
  baseChassisStats: ChassisBaseStats;
  cleaningMasterLevel?: number;
}): number {
  const { chassisStats, baseChassisStats } = input;
  let bonus = 0;
  for (const key of Object.keys(FLOOD_PUSH_STAT_WEIGHTS) as (keyof ChassisBaseStats)[]) {
    const delta = Math.max(0, chassisStats[key] - baseChassisStats[key]);
    bonus += delta * FLOOD_PUSH_STAT_WEIGHTS[key];
  }
  const fromStats = Math.floor(FLOOD_BASE_PUSH_UNITS * (1 + bonus));
  return Math.max(
    FLOOD_BASE_PUSH_UNITS,
    Math.floor(fromStats * floodCleaningMasterMult(input.cleaningMasterLevel ?? 0)),
  );
}

export function rollFloodScore(
  kind: FloodRewardKind,
  critical: boolean,
  criticalMultiplier: number,
): number {
  const cfg = YANMAR_FLOOD_REWARD_CONFIG[kind];
  const base =
    cfg.baseScoreMin +
    Math.floor(Math.random() * (cfg.baseScoreMax - cfg.baseScoreMin + 1));
  return critical ? Math.round(base * criticalMultiplier) : base;
}

export function rollFloodXp(kind: FloodRewardKind): number {
  const cfg = YANMAR_FLOOD_REWARD_CONFIG[kind];
  return (
    cfg.xpMin + Math.floor(Math.random() * (cfg.xpMax - cfg.xpMin + 1))
  );
}
