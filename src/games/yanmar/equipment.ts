export const YANMAR_REWARD_CONFIG = {
  baseMaxLoadUnits: 1000,
  baseTruckCapacityUnits: 3000,
  baseTruckCooldownSec: 300,
  scoreChunkUnits: 200,
  baseScorePerChunkMin: 80,
  baseScorePerChunkMax: 100,
  baseCriticalChance: 0.25,
  baseCriticalMultiplier: 2,
  couponExpiresInDays: 365,
  /** Max game-drop coupons of each type per season (resets when a new season starts). */
  partsCouponSeasonLimit: 50,
  rentalCouponSeasonLimit: 50,
  /** 필터세트 교환쿠폰 — 시즌당 1장 */
  filterSetCouponSeasonLimit: 1,
  partsCouponChance: 0.005,
  rentalCouponChance: 0.005,
  /** 0.0001% = 1e-6 */
  filterSetCouponChance: 0.000001,
  minStarReward: 1,
  maxStarReward: 3,
} as const;

/** Crash(아스팔트) 타일 1개 파괴 보상 — 쿠폰 확률은 하역과 동일, 스타 수량만 별도. */
export const YANMAR_CRASH_REWARD_CONFIG = {
  baseScoreMin: 350,
  baseScoreMax: 400,
  minStarReward: 5,
  maxStarReward: 15,
  xpReward: 1000,
} as const;

/** Hill(돌) 1개 트럭 적재 보상 — 쿠폰 확률은 하역과 동일. */
export const YANMAR_HILL_REWARD_CONFIG = {
  baseScoreMin: 900,
  baseScoreMax: 1000,
  minStarReward: 10,
  maxStarReward: 15,
  xpMin: 900,
  xpMax: 1000,
} as const;

export const YANMAR_TRUCK_UPGRADE_COSTS = [
  50, 100, 150, 200, 250, 300, 400, 500, 750, 1000,
] as const;

export const YANMAR_SPECIAL_UPGRADE_COSTS = [
  50, 100, 150, 200, 250, 300, 350, 400, 450, 500,
] as const;

export const YANMAR_HILL_ROCK_PICK_COSTS = [
  75, 150, 225, 300, 500,
] as const;

export const YANMAR_BASE_BREAKER_DAMAGE = 10;
export const YANMAR_BASE_HAUL_TRUCK_COOLDOWN_SEC = 300;
export const YANMAR_BASE_HAUL_TRUCK_CAPACITY = 5;
export const YANMAR_BASE_HILL_BOULDER_COUNT = 5;

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
    label: "[덤프트럭] 내구력 강화",
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
  CRASH_RESPAWN: {
    label: "브레이커",
    maxLevel: 10,
    damagePerLevel: 5,
    description: "콘크리트 데미지 +5",
  },
  GRAPPLE_ADHESION: {
    label: "집게",
    maxLevel: 10,
    adhesionBonusPerLevel: 0.03,
    description: "밀착감 +3%",
  },
  HAUL_TRUCK_SPEED: {
    label: "돌트럭속도",
    maxLevel: 10,
    cooldownReductionPerLevel: 0.05,
    description: "돌트럭 복귀시간 -5%",
  },
  HILL_ROCK_PICK: {
    label: "돌 고르기",
    maxLevel: 5,
    rocksPerLevel: 1,
    description: "돌지역 돌개수 +1",
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
  breakerDamage: number;
  crashRespawnSec: number;
  haulTruckCooldownSec: number;
  haulTruckCapacity: number;
  hillBoulderCount: number;
  /** 집게 강화로 더해지는 밀착감 보너스 (0~0.3). */
  gripAdhesionBonus: number;
}

export const DEFAULT_YANMAR_EQUIPMENT_LEVELS: YanmarEquipmentLevels = {
  ARM: 0,
  BOOM: 0,
  BUCKET: 0,
  ENGINE: 0,
  TRUCK_CAPACITY: 0,
  TRUCK_SPEED: 0,
  CRASH_RESPAWN: 0,
  GRAPPLE_ADHESION: 0,
  HAUL_TRUCK_SPEED: 0,
  HILL_ROCK_PICK: 0,
};

export const YANMAR_UPGRADE_COSTS = {
  ARM: [10, 25, 50, 75, 100, 150, 200, 300, 500, 1000],
  BOOM: [10, 25, 50, 75, 100, 150, 200, 300, 500, 1000],
  BUCKET: [20, 50, 100, 200, 500],
  ENGINE: [20, 50, 100, 200, 500],
  TRUCK_CAPACITY: YANMAR_TRUCK_UPGRADE_COSTS,
  TRUCK_SPEED: YANMAR_TRUCK_UPGRADE_COSTS,
  CRASH_RESPAWN: YANMAR_SPECIAL_UPGRADE_COSTS,
  GRAPPLE_ADHESION: YANMAR_SPECIAL_UPGRADE_COSTS,
  HAUL_TRUCK_SPEED: YANMAR_SPECIAL_UPGRADE_COSTS,
  HILL_ROCK_PICK: YANMAR_HILL_ROCK_PICK_COSTS,
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

export function getYanmarPartSpentUpgradeCost(
  part: YanmarEquipmentPart,
  level: number,
) {
  const safeLevel = Math.max(
    0,
    Math.min(YANMAR_EQUIPMENT_CONFIG[part].maxLevel, Math.floor(level)),
  );
  return YANMAR_UPGRADE_COSTS[part]
    .slice(0, safeLevel)
    .reduce((sum, cost) => sum + cost, 0);
}

export function getYanmarPartResetRefundStars(
  part: YanmarEquipmentPart,
  level: number,
) {
  return Math.floor(
    getYanmarPartSpentUpgradeCost(part, level) * YANMAR_EQUIPMENT_RESET_REFUND_RATE,
  );
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
  let legacyHaulTruckSpeed = 0;
  let hasGrappleAdhesion = false;
  for (const row of rows) {
    if (row.part === LEGACY_TRUCK_EQUIPMENT_PART) {
      levels.TRUCK_CAPACITY = Math.max(
        levels.TRUCK_CAPACITY,
        Math.min(YANMAR_EQUIPMENT_CONFIG.TRUCK_CAPACITY.maxLevel, row.level),
      );
      continue;
    }
    if (row.part === "GRAPPLE_ADHESION") {
      hasGrappleAdhesion = true;
    }
    if (row.part === "HAUL_TRUCK_SPEED") {
      legacyHaulTruckSpeed = row.level;
    }
    if (row.part in YANMAR_EQUIPMENT_CONFIG) {
      levels[row.part as YanmarEquipmentPart] = row.level;
    }
  }
  // 이전 세션에서 HAUL_TRUCK_SPEED에 저장된 밀착감 강화를 GRAPPLE_ADHESION으로 이전
  if (!hasGrappleAdhesion && legacyHaulTruckSpeed > 0) {
    levels.GRAPPLE_ADHESION = Math.min(
      YANMAR_EQUIPMENT_CONFIG.GRAPPLE_ADHESION.maxLevel,
      legacyHaulTruckSpeed,
    );
    levels.HAUL_TRUCK_SPEED = 0;
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

export function rollYanmarCrashBaseScore(): number {
  const { baseScoreMin, baseScoreMax } = YANMAR_CRASH_REWARD_CONFIG;
  return Math.floor(Math.random() * (baseScoreMax - baseScoreMin + 1)) + baseScoreMin;
}

export function calculateYanmarCrashScore(
  stats: YanmarEquipmentStats,
  critical: boolean,
  baseScore = rollYanmarCrashBaseScore(),
): number {
  return Math.round(baseScore * (critical ? stats.criticalMultiplier : 1));
}

export function rollYanmarHillBaseScore(): number {
  const { baseScoreMin, baseScoreMax } = YANMAR_HILL_REWARD_CONFIG;
  return Math.floor(Math.random() * (baseScoreMax - baseScoreMin + 1)) + baseScoreMin;
}

export function calculateYanmarHillScore(
  stats: YanmarEquipmentStats,
  critical: boolean,
  baseScore = rollYanmarHillBaseScore(),
): number {
  return Math.round(baseScore * (critical ? stats.criticalMultiplier : 1));
}

export function rollYanmarHillXp(): number {
  const { xpMin, xpMax } = YANMAR_HILL_REWARD_CONFIG;
  return Math.floor(Math.random() * (xpMax - xpMin + 1)) + xpMin;
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
    breakerDamage: getYanmarBreakerDamage(safeLevels.CRASH_RESPAWN),
    crashRespawnSec: 5 * 60,
    haulTruckCooldownSec: getYanmarHaulTruckCooldownSec(safeLevels.HAUL_TRUCK_SPEED),
    haulTruckCapacity: YANMAR_BASE_HAUL_TRUCK_CAPACITY,
    hillBoulderCount: getYanmarHillBoulderCount(safeLevels.HILL_ROCK_PICK),
    gripAdhesionBonus: getYanmarGripAdhesionBonus(safeLevels.GRAPPLE_ADHESION),
  };
}

export function getYanmarBreakerDamage(level = 0) {
  const safeLevel = Math.max(
    0,
    Math.min(YANMAR_EQUIPMENT_CONFIG.CRASH_RESPAWN.maxLevel, Math.floor(level)),
  );
  return (
    YANMAR_BASE_BREAKER_DAMAGE +
    safeLevel * YANMAR_EQUIPMENT_CONFIG.CRASH_RESPAWN.damagePerLevel
  );
}

export function getYanmarGripAdhesionBonus(level = 0) {
  const safeLevel = Math.max(
    0,
    Math.min(YANMAR_EQUIPMENT_CONFIG.GRAPPLE_ADHESION.maxLevel, Math.floor(level)),
  );
  return (
    safeLevel * YANMAR_EQUIPMENT_CONFIG.GRAPPLE_ADHESION.adhesionBonusPerLevel
  );
}

export function getYanmarHaulTruckCooldownSec(level = 0) {
  const safeLevel = Math.max(
    0,
    Math.min(YANMAR_EQUIPMENT_CONFIG.HAUL_TRUCK_SPEED.maxLevel, Math.floor(level)),
  );
  const factor =
    1 - YANMAR_EQUIPMENT_CONFIG.HAUL_TRUCK_SPEED.cooldownReductionPerLevel;
  return Math.max(
    30,
    YANMAR_BASE_HAUL_TRUCK_COOLDOWN_SEC * factor ** safeLevel,
  );
}

export function getYanmarHillBoulderCount(level = 0) {
  const safeLevel = Math.max(
    0,
    Math.min(YANMAR_EQUIPMENT_CONFIG.HILL_ROCK_PICK.maxLevel, Math.floor(level)),
  );
  return (
    YANMAR_BASE_HILL_BOULDER_COUNT +
    safeLevel * YANMAR_EQUIPMENT_CONFIG.HILL_ROCK_PICK.rocksPerLevel
  );
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

/** 장비강화 UI — 부위별 스탯 라벨 */
export function getYanmarUpgradePartStatLabel(part: YanmarEquipmentPart): string {
  switch (part) {
    case "BOOM":
      return "크리점수";
    case "ARM":
      return "크리확률";
    case "BUCKET":
      return "적재량";
    case "ENGINE":
      return "이동속도";
    case "TRUCK_CAPACITY":
      return "하역량";
    case "TRUCK_SPEED":
      return "트럭복귀";
    case "CRASH_RESPAWN":
      return "데미지";
    case "GRAPPLE_ADHESION":
      return "밀착감";
    case "HAUL_TRUCK_SPEED":
      return "돌트럭복귀";
    case "HILL_ROCK_PICK":
      return "돌개수";
    default:
      return "";
  }
}

/** 장비강화 UI — 부위별 현재 스탯 한 줄 표기 */
export function getYanmarUpgradePartStatText(
  part: YanmarEquipmentPart,
  level = 0,
): string {
  const config = YANMAR_EQUIPMENT_CONFIG[part];
  const safeLevel = Math.max(0, Math.min(config.maxLevel, Math.floor(level)));
  const label = getYanmarUpgradePartStatLabel(part);

  switch (part) {
    case "BOOM":
      return `${label}${Math.round(
        safeLevel * YANMAR_EQUIPMENT_CONFIG.BOOM.effectPerLevel * 100,
      )}%`;
    case "ARM":
      return `${label}${Math.round(
        (YANMAR_REWARD_CONFIG.baseCriticalChance +
          safeLevel * YANMAR_EQUIPMENT_CONFIG.ARM.effectPerLevel) *
          100,
      )}%`;
    case "BUCKET":
      return `${label}${
        YANMAR_REWARD_CONFIG.baseMaxLoadUnits +
        safeLevel * YANMAR_EQUIPMENT_CONFIG.BUCKET.effectPerLevel
      }`;
    case "ENGINE":
      return `${label}${Math.round(
        safeLevel * YANMAR_EQUIPMENT_CONFIG.ENGINE.effectPerLevel * 100,
      )}%`;
    case "TRUCK_CAPACITY":
      return `${label}${getYanmarTruckCapacityUnits(safeLevel)}`;
    case "TRUCK_SPEED":
      return `${label}${Math.round(getYanmarTruckCooldownSec(safeLevel))}초`;
    case "CRASH_RESPAWN":
      return `${label}${getYanmarBreakerDamage(safeLevel)}`;
    case "GRAPPLE_ADHESION":
      return `${label}+${Math.round(getYanmarGripAdhesionBonus(safeLevel) * 100)}%`;
    case "HAUL_TRUCK_SPEED":
      return `${label}${Math.round(getYanmarHaulTruckCooldownSec(safeLevel))}초`;
    case "HILL_ROCK_PICK":
      return `${label}${getYanmarHillBoulderCount(safeLevel)}`;
    default:
      return "";
  }
}

export function getYanmarUpgradePartStatValue(
  part: YanmarEquipmentPart,
  level = 0,
): string {
  const text = getYanmarUpgradePartStatText(part, level);
  const label = getYanmarUpgradePartStatLabel(part);
  return text.startsWith(label) ? text.slice(label.length) : text;
}

/** 1회 강화 시 증가량 — `(+200)` 형태 */
export function getYanmarUpgradePartGainText(
  part: YanmarEquipmentPart,
  level = 0,
): string {
  const config = YANMAR_EQUIPMENT_CONFIG[part];
  const safeLevel = Math.max(0, Math.min(config.maxLevel - 1, Math.floor(level)));

  switch (part) {
    case "BOOM":
      return `(+${Math.round(YANMAR_EQUIPMENT_CONFIG.BOOM.effectPerLevel * 100)}%)`;
    case "ARM":
      return `(+${Math.round(YANMAR_EQUIPMENT_CONFIG.ARM.effectPerLevel * 100)}%)`;
    case "BUCKET":
      return `(+${YANMAR_EQUIPMENT_CONFIG.BUCKET.effectPerLevel})`;
    case "ENGINE":
      return `(+${Math.round(YANMAR_EQUIPMENT_CONFIG.ENGINE.effectPerLevel * 100)}%)`;
    case "TRUCK_CAPACITY":
      return `(+${YANMAR_EQUIPMENT_CONFIG.TRUCK_CAPACITY.capacityPerLevel})`;
    case "TRUCK_SPEED": {
      const saved = Math.round(
        getYanmarTruckCooldownSec(safeLevel) - getYanmarTruckCooldownSec(safeLevel + 1),
      );
      return `(-${saved}초)`;
    }
    case "CRASH_RESPAWN":
      return `(+${YANMAR_EQUIPMENT_CONFIG.CRASH_RESPAWN.damagePerLevel})`;
    case "GRAPPLE_ADHESION":
      return `(+${Math.round(YANMAR_EQUIPMENT_CONFIG.GRAPPLE_ADHESION.adhesionBonusPerLevel * 100)}%)`;
    case "HAUL_TRUCK_SPEED": {
      const saved = Math.round(
        getYanmarHaulTruckCooldownSec(safeLevel) -
          getYanmarHaulTruckCooldownSec(safeLevel + 1),
      );
      return `(-${saved}초)`;
    }
    case "HILL_ROCK_PICK":
      return `(+${YANMAR_EQUIPMENT_CONFIG.HILL_ROCK_PICK.rocksPerLevel})`;
    default:
      return "";
  }
}

export function getLoadUnits(bucketLoadRatio: number, maxLoadUnits: number) {
  return Math.round(Math.max(0, Math.min(1, bucketLoadRatio)) * maxLoadUnits);
}
