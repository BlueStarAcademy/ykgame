export const YANMAR_REWARD_CONFIG = {
  baseMaxLoadUnits: 1000,
  baseTruckCapacityUnits: 3000,
  baseTruckCooldownSec: 600,
  scoreChunkUnits: 200,
  baseScorePerChunkMin: 80,
  baseScorePerChunkMax: 100,
  baseCriticalChance: 0.25,
  baseCriticalMultiplier: 2,
  couponExpiresInDays: 90,
  partsCouponChance: 0.005,
  rentalCouponChance: 0.005,
  minStarReward: 1,
  maxStarReward: 3,
} as const;

export const YANMAR_TRUCK_UPGRADE_COSTS = [
  50, 100, 150, 200, 250, 300, 400, 500, 750, 1000,
] as const;

export const YANMAR_EQUIPMENT_CONFIG = {
  ARM: {
    label: "암",
    maxLevel: 10,
    effectPerLevel: 0.03,
    description: "크리티컬 확률 +3%p",
  },
  BOOM: {
    label: "붐",
    maxLevel: 10,
    effectPerLevel: 0.1,
    description: "크리티컬 점수 배율 +10%",
  },
  BUCKET: {
    label: "버켓",
    maxLevel: 5,
    effectPerLevel: 200,
    description: "최대 적재량 +200",
  },
  ENGINE: {
    label: "엔진",
    maxLevel: 5,
    effectPerLevel: 0.1,
    description: "이동속도 +10%",
  },
  TRUCK_CAPACITY: {
    label: "[덤프트럭] 하역량 증가",
    maxLevel: 10,
    capacityPerLevel: 500,
    description: "최대 하역량 +500",
  },
  TRUCK_SPEED: {
    label: "[덤프트럭] 속도 상승",
    maxLevel: 10,
    cooldownReductionPerLevel: 0.05,
    description: "복귀 대기 5% 단축",
  },
} as const;

export type YanmarEquipmentPart = keyof typeof YANMAR_EQUIPMENT_CONFIG;

export type YanmarEquipmentLevels = Record<YanmarEquipmentPart, number>;

export interface YanmarEquipmentStats {
  maxLoadUnits: number;
  truckCapacityUnits: number;
  truckCooldownSec: number;
  scoreChunkUnits: number;
  criticalChance: number;
  criticalMultiplier: number;
  travelSpeedMultiplier: number;
}

export const DEFAULT_YANMAR_EQUIPMENT_LEVELS: YanmarEquipmentLevels = {
  ARM: 0,
  BOOM: 0,
  BUCKET: 0,
  ENGINE: 0,
  TRUCK_CAPACITY: 0,
  TRUCK_SPEED: 0,
};

export const YANMAR_UPGRADE_COSTS = {
  ARM: [10, 25, 50, 75, 100, 150, 200, 300, 500, 1000],
  BOOM: [10, 25, 50, 75, 100, 150, 200, 300, 500, 1000],
  BUCKET: [20, 50, 100, 200, 500],
  ENGINE: [20, 50, 100, 200, 500],
  TRUCK_CAPACITY: YANMAR_TRUCK_UPGRADE_COSTS,
  TRUCK_SPEED: YANMAR_TRUCK_UPGRADE_COSTS,
} as const satisfies Record<YanmarEquipmentPart, readonly number[]>;

export const YANMAR_EQUIPMENT_RESET_REFUND_RATE = 0.7;

/** @deprecated legacy DB row — migrated to TRUCK_CAPACITY */
export const LEGACY_TRUCK_EQUIPMENT_PART = "TRUCK" as const;

export function getYanmarUpgradeCost(part: YanmarEquipmentPart, nextLevel: number) {
  if (nextLevel < 1) return 0;
  return YANMAR_UPGRADE_COSTS[part][nextLevel - 1] ?? 0;
}

export function getYanmarSpentUpgradeCost(
  levels: Partial<Record<YanmarEquipmentPart, number>>,
) {
  const safeLevels = clampYanmarEquipmentLevels(levels);
  return (Object.keys(YANMAR_EQUIPMENT_CONFIG) as YanmarEquipmentPart[]).reduce(
    (total, part) => {
      const costs = YANMAR_UPGRADE_COSTS[part];
      const level = safeLevels[part];
      return total + costs.slice(0, level).reduce((sum, cost) => sum + cost, 0);
    },
    0,
  );
}

export function getYanmarResetRefundStars(
  levels: Partial<Record<YanmarEquipmentPart, number>>,
) {
  return Math.floor(getYanmarSpentUpgradeCost(levels) * YANMAR_EQUIPMENT_RESET_REFUND_RATE);
}

export function formatYanmarUpgradeCostSequence(part: YanmarEquipmentPart, maxLevel: number) {
  return Array.from({ length: maxLevel }, (_, index) =>
    getYanmarUpgradeCost(part, index + 1),
  ).join(" / ");
}

export function mergeYanmarEquipmentLevelsFromDb(
  rows: Array<{ part: string; level: number }>,
): YanmarEquipmentLevels {
  const levels = { ...DEFAULT_YANMAR_EQUIPMENT_LEVELS };
  for (const row of rows) {
    if (row.part === LEGACY_TRUCK_EQUIPMENT_PART) {
      levels.TRUCK_CAPACITY = Math.max(
        levels.TRUCK_CAPACITY,
        Math.min(YANMAR_EQUIPMENT_CONFIG.TRUCK_CAPACITY.maxLevel, row.level),
      );
      continue;
    }
    if (row.part in YANMAR_EQUIPMENT_CONFIG) {
      levels[row.part as YanmarEquipmentPart] = row.level;
    }
  }
  return clampYanmarEquipmentLevels(levels);
}

export function clampYanmarEquipmentLevels(
  levels: Partial<Record<YanmarEquipmentPart, number>>,
): YanmarEquipmentLevels {
  return (Object.keys(YANMAR_EQUIPMENT_CONFIG) as YanmarEquipmentPart[]).reduce(
    (acc, part) => {
      const config = YANMAR_EQUIPMENT_CONFIG[part];
      const rawLevel = levels[part] ?? 0;
      acc[part] = Math.max(0, Math.min(config.maxLevel, Math.floor(rawLevel)));
      return acc;
    },
    { ...DEFAULT_YANMAR_EQUIPMENT_LEVELS },
  );
}

export function rollYanmarBaseScorePerChunk(): number {
  const min = YANMAR_REWARD_CONFIG.baseScorePerChunkMin;
  const max = YANMAR_REWARD_CONFIG.baseScorePerChunkMax;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function calculateYanmarChunkScore(
  stats: YanmarEquipmentStats,
  critical: boolean,
  baseScore = rollYanmarBaseScorePerChunk(),
): number {
  return Math.round(baseScore * (critical ? stats.criticalMultiplier : 1));
}

export function calculateYanmarEquipmentStats(
  levels: Partial<Record<YanmarEquipmentPart, number>>,
): YanmarEquipmentStats {
  const safeLevels = clampYanmarEquipmentLevels(levels);
  return {
    maxLoadUnits:
      YANMAR_REWARD_CONFIG.baseMaxLoadUnits +
      safeLevels.BUCKET * YANMAR_EQUIPMENT_CONFIG.BUCKET.effectPerLevel,
    truckCapacityUnits: getYanmarTruckCapacityUnits(safeLevels.TRUCK_CAPACITY),
    truckCooldownSec: getYanmarTruckCooldownSec(safeLevels.TRUCK_SPEED),
    scoreChunkUnits: YANMAR_REWARD_CONFIG.scoreChunkUnits,
    criticalChance:
      YANMAR_REWARD_CONFIG.baseCriticalChance +
      safeLevels.ARM * YANMAR_EQUIPMENT_CONFIG.ARM.effectPerLevel,
    criticalMultiplier:
      YANMAR_REWARD_CONFIG.baseCriticalMultiplier +
      safeLevels.BOOM * YANMAR_EQUIPMENT_CONFIG.BOOM.effectPerLevel,
    travelSpeedMultiplier:
      1 + safeLevels.ENGINE * YANMAR_EQUIPMENT_CONFIG.ENGINE.effectPerLevel,
  };
}

export function getYanmarTruckCapacityUnits(capacityLevel = 0) {
  const level = Math.max(
    0,
    Math.min(YANMAR_EQUIPMENT_CONFIG.TRUCK_CAPACITY.maxLevel, Math.floor(capacityLevel)),
  );
  return (
    YANMAR_REWARD_CONFIG.baseTruckCapacityUnits +
    level * YANMAR_EQUIPMENT_CONFIG.TRUCK_CAPACITY.capacityPerLevel
  );
}

export function getYanmarTruckCooldownSec(speedLevel = 0) {
  const level = Math.max(
    0,
    Math.min(YANMAR_EQUIPMENT_CONFIG.TRUCK_SPEED.maxLevel, Math.floor(speedLevel)),
  );
  const factor = 1 - YANMAR_EQUIPMENT_CONFIG.TRUCK_SPEED.cooldownReductionPerLevel;
  return Math.max(
    30,
    YANMAR_REWARD_CONFIG.baseTruckCooldownSec * factor ** level,
  );
}

export function getLoadUnits(bucketLoadRatio: number, maxLoadUnits: number) {
  return Math.round(Math.max(0, Math.min(1, bucketLoadRatio)) * maxLoadUnits);
}
