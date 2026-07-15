export const YANMAR_REWARD_CONFIG = {
  baseMaxLoadUnits: 1000,
  baseTruckCapacityUnits: 3000,
  baseTruckCooldownSec: 300,
  scoreChunkUnits: 200,
  baseScorePerChunkMin: 80,
  baseScorePerChunkMax: 100,
  baseCriticalChance: 0.05,
  baseCriticalMultiplier: 2,
  couponExpiresInDays: 365,
  /** Max game-drop coupons of each type per season (resets when a new season starts). */
  partsCouponSeasonLimit: 50,
  rentalCouponSeasonLimit: 50,
  /** 필터세트 교환쿠폰 — 시즌당 1장 */
  filterSetCouponSeasonLimit: 1,
  /**
   * 스타와 독립적인 쿠폰 추가 드롭 확률.
   * 0.00001% = 1e-7
   */
  couponDropChance: 0.0000001,
  /**
   * 쿠폰 드롭 성공 시 종류 선택 상대 가중치 (합으로 정규화).
   * 지금은 동일 비중, 추후 종류별 조정 가능.
   */
  couponTypeWeights: {
    FILTER_SET_EXCHANGE: 1,
    YK_PARTS_DISCOUNT: 1,
    EQUIPMENT_RENTAL_DISCOUNT: 1,
  },
  minStarReward: 1,
  maxStarReward: 3,
} as const;

/** Crash(아스팔트) 타일 1개 파괴 보상 — 쿠폰 드롭은 하역과 동일, 스타 수량만 별도. */
export const YANMAR_CRASH_REWARD_CONFIG = {
  baseScoreMin: 350,
  baseScoreMax: 400,
  minStarReward: 5,
  maxStarReward: 15,
  xpReward: 1000,
} as const;

/** Hill(돌) 1개 트럭 적재(하역) 보상 — 쿠폰 드롭은 하역과 동일. */
export const YANMAR_HILL_REWARD_CONFIG = {
  baseScoreMin: 900,
  baseScoreMax: 1000,
  minStarReward: 20,
  maxStarReward: 30,
  xpMin: 1800,
  xpMax: 2000,
} as const;

/** 모든 부위 공통 강화 비용 (+1 ~ +10). */
export const YANMAR_UNIFIED_UPGRADE_COSTS = [
  20, 30, 50, 100, 150, 200, 250, 300, 400, 500,
] as const;

/** @deprecated Use YANMAR_UNIFIED_UPGRADE_COSTS */
export const YANMAR_TRUCK_UPGRADE_COSTS = YANMAR_UNIFIED_UPGRADE_COSTS;
/** @deprecated Use YANMAR_UNIFIED_UPGRADE_COSTS */
export const YANMAR_SPECIAL_UPGRADE_COSTS = YANMAR_UNIFIED_UPGRADE_COSTS;

/**
 * 다음 강화 단계(+1~+10)별 기본 성공률과 실패 시 누적 보너스.
 * failBonus는 같은 단계 재도전 성공률에 가산된다.
 */
export const YANMAR_UPGRADE_ATTEMPT = [
  { successRate: 1.0, failBonus: 0 },
  { successRate: 0.9, failBonus: 0.1 },
  { successRate: 0.8, failBonus: 0.08 },
  { successRate: 0.7, failBonus: 0.06 },
  { successRate: 0.6, failBonus: 0.04 },
  { successRate: 0.5, failBonus: 0.02 },
  { successRate: 0.45, failBonus: 0.01 },
  { successRate: 0.4, failBonus: 0.005 },
  { successRate: 0.35, failBonus: 0.005 },
  { successRate: 0.3, failBonus: 0.005 },
] as const;

export const YANMAR_BASE_BREAKER_DAMAGE_MIN = 6;
export const YANMAR_BASE_BREAKER_DAMAGE_MAX = 10;
/** @deprecated Use MIN/MAX — kept as max for older references. */
export const YANMAR_BASE_BREAKER_DAMAGE = YANMAR_BASE_BREAKER_DAMAGE_MAX;
export const YANMAR_BASE_HAUL_TRUCK_COOLDOWN_SEC = 300;
export const YANMAR_BASE_HAUL_TRUCK_CAPACITY = 5;
export const YANMAR_BASE_HILL_BOULDER_COUNT = 5;
/** 돌 적재 실패 시 기본 재적재(안전적재) 확률. */
export const YANMAR_BASE_HILL_SAFE_LOAD_CHANCE = 0.2;

/** 단계별 증가량 (+1 ~ +10). 고강화일수록 더 큼. */
export const YANMAR_UPGRADE_BONUSES = {
  ARM: [0.02, 0.02, 0.02, 0.02, 0.03, 0.03, 0.03, 0.03, 0.05, 0.1],
  BOOM: [0.05, 0.05, 0.05, 0.05, 0.1, 0.1, 0.1, 0.1, 0.15, 0.2],
  BUCKET: [100, 100, 100, 100, 200, 200, 200, 200, 300, 500],
  ENGINE: [0.05, 0.05, 0.05, 0.05, 0.07, 0.07, 0.07, 0.07, 0.09, 0.13],
  TRUCK_CAPACITY: [200, 200, 200, 200, 300, 300, 300, 300, 500, 1000],
  TRUCK_SPEED: [10, 10, 10, 10, 15, 15, 15, 15, 20, 30],
  CRASH_RESPAWN: [4, 4, 4, 4, 5, 5, 5, 5, 8, 15],
  GRAPPLE_ADHESION: [0.02, 0.02, 0.02, 0.02, 0.03, 0.03, 0.03, 0.03, 0.05, 0.1],
  HAUL_TRUCK_SPEED: [10, 10, 10, 10, 15, 15, 15, 15, 20, 30],
  HILL_SAFE_LOAD: [0.02, 0.02, 0.02, 0.02, 0.03, 0.03, 0.03, 0.03, 0.05, 0.1],
} as const;

export const YANMAR_EQUIPMENT_CONFIG = {
  ARM: {
    label: "암",
    maxLevel: 10,
    description: "크리티컬 확률 증가",
  },
  BOOM: {
    label: "붐",
    maxLevel: 10,
    description: "크리티컬 점수 증가",
  },
  BUCKET: {
    label: "버켓",
    maxLevel: 10,
    description: "흙 최대 적재량 증가",
  },
  ENGINE: {
    label: "엔진",
    maxLevel: 10,
    description: "이동속도 증가",
  },
  TRUCK_CAPACITY: {
    label: "[덤프트럭] 내구력 강화",
    maxLevel: 10,
    description: "최대 하역량 증가",
  },
  TRUCK_SPEED: {
    label: "[덤프트럭] 속도 강화",
    maxLevel: 10,
    description: "복귀 대기시간 감소",
  },
  CRASH_RESPAWN: {
    label: "브레이커",
    maxLevel: 10,
    description: "콘크리트 데미지 증가",
  },
  GRAPPLE_ADHESION: {
    label: "집게",
    maxLevel: 10,
    description: "밀착감 증가",
  },
  HAUL_TRUCK_SPEED: {
    label: "[돌트럭] 속도 강화",
    maxLevel: 10,
    description: "복귀 대기시간 감소",
  },
  HILL_SAFE_LOAD: {
    label: "[돌트럭] 안전적재",
    maxLevel: 10,
    description: "돌 적재 실패 시 재적재 확률 증가",
  },
} as const;

export type YanmarEquipmentPart = keyof typeof YANMAR_EQUIPMENT_CONFIG;

export type YanmarEquipmentLevels = Record<YanmarEquipmentPart, number>;

/** 부위별 실패 누적 성공률 보너스 (0~1). */
export type YanmarEquipmentFailBonuses = Record<YanmarEquipmentPart, number>;

export interface YanmarEquipmentStats {
  maxLoadUnits: number;
  truckCapacityUnits: number;
  truckCooldownSec: number;
  scoreChunkUnits: number;
  criticalChance: number;
  criticalMultiplier: number;
  /** Maintenance / other global score penalty (default 1). */
  scoreMult?: number;
  travelSpeedMultiplier: number;
  /** 붐/암 속도 배율 (선회·버켓·블레이드·집게 제외) */
  workSpeedMultiplier: number;
  /** Upgrade bonus added to each 6~10 base hit roll. */
  breakerDamage: number;
  crashRespawnSec: number;
  haulTruckCooldownSec: number;
  haulTruckCapacity: number;
  hillBoulderCount: number;
  /** 집게 강화로 더해지는 밀착감 보너스. */
  gripAdhesionBonus: number;
  /** 돌 적재 실패 시 돌이 깨지지 않을 확률. */
  hillSafeLoadChance: number;
  /** 마스터옵션: 브레이커 3회마다 데미지 배수 (없으면 1) */
  breakerEvery3HitMult?: number;
  /** 블레이드 주옵션 효율 (기본 1) */
  bladeEfficiency?: number;
  /** 작업 반경/도달 (기본 1). 능력치 파생으로 확장 가능 */
  reachMultiplier?: number;
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
  HILL_SAFE_LOAD: 0,
};

export const DEFAULT_YANMAR_EQUIPMENT_FAIL_BONUSES: YanmarEquipmentFailBonuses = {
  ARM: 0,
  BOOM: 0,
  BUCKET: 0,
  ENGINE: 0,
  TRUCK_CAPACITY: 0,
  TRUCK_SPEED: 0,
  CRASH_RESPAWN: 0,
  GRAPPLE_ADHESION: 0,
  HAUL_TRUCK_SPEED: 0,
  HILL_SAFE_LOAD: 0,
};

export const YANMAR_UPGRADE_COSTS = {
  ARM: YANMAR_UNIFIED_UPGRADE_COSTS,
  BOOM: YANMAR_UNIFIED_UPGRADE_COSTS,
  BUCKET: YANMAR_UNIFIED_UPGRADE_COSTS,
  ENGINE: YANMAR_UNIFIED_UPGRADE_COSTS,
  TRUCK_CAPACITY: YANMAR_UNIFIED_UPGRADE_COSTS,
  TRUCK_SPEED: YANMAR_UNIFIED_UPGRADE_COSTS,
  CRASH_RESPAWN: YANMAR_UNIFIED_UPGRADE_COSTS,
  GRAPPLE_ADHESION: YANMAR_UNIFIED_UPGRADE_COSTS,
  HAUL_TRUCK_SPEED: YANMAR_UNIFIED_UPGRADE_COSTS,
  HILL_SAFE_LOAD: YANMAR_UNIFIED_UPGRADE_COSTS,
} as const satisfies Record<YanmarEquipmentPart, readonly number[]>;

export const YANMAR_EQUIPMENT_RESET_REFUND_RATE = 0.7;

/** @deprecated legacy DB row — migrated to TRUCK_CAPACITY */
export const LEGACY_TRUCK_EQUIPMENT_PART = "TRUCK" as const;
/** @deprecated removed upgrade — kept for DB enum compatibility */
export const LEGACY_HILL_ROCK_PICK_PART = "HILL_ROCK_PICK" as const;

export function sumUpgradeBonuses(
  bonuses: readonly number[],
  level: number,
): number {
  const safeLevel = Math.max(0, Math.min(bonuses.length, Math.floor(level)));
  let total = 0;
  for (let i = 0; i < safeLevel; i += 1) {
    total += bonuses[i] ?? 0;
  }
  return total;
}

export function getUpgradeBonusAtLevel(
  bonuses: readonly number[],
  level: number,
): number {
  if (level < 1 || level > bonuses.length) return 0;
  return bonuses[level - 1] ?? 0;
}

export function getYanmarUpgradeCost(part: YanmarEquipmentPart, nextLevel: number) {
  if (nextLevel < 1) return 0;
  return YANMAR_UPGRADE_COSTS[part][nextLevel - 1] ?? 0;
}

export function getYanmarUpgradeAttempt(nextLevel: number) {
  if (nextLevel < 1 || nextLevel > YANMAR_UPGRADE_ATTEMPT.length) {
    return null;
  }
  return YANMAR_UPGRADE_ATTEMPT[nextLevel - 1] ?? null;
}

export function getYanmarUpgradeSuccessRate(
  nextLevel: number,
  failBonusAccum = 0,
) {
  const attempt = getYanmarUpgradeAttempt(nextLevel);
  if (!attempt) return 0;
  // Additive pity: base% + accumulated fail bonuses (not multiplicative).
  return Math.min(1, Math.max(0, attempt.successRate + Math.max(0, failBonusAccum)));
}

export function getYanmarUpgradeFailBonusGain(nextLevel: number) {
  return getYanmarUpgradeAttempt(nextLevel)?.failBonus ?? 0;
}

export function formatYanmarSuccessRate(rate: number) {
  const pct = rate * 100;
  const rounded = Math.round(pct * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
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

export function mergeYanmarEquipmentFailBonusesFromDb(
  rows: Array<{ part: string; failBonus?: number | null }>,
): YanmarEquipmentFailBonuses {
  const bonuses = { ...DEFAULT_YANMAR_EQUIPMENT_FAIL_BONUSES };
  for (const row of rows) {
    if (row.part in YANMAR_EQUIPMENT_CONFIG) {
      const value = Number(row.failBonus ?? 0);
      bonuses[row.part as YanmarEquipmentPart] = Number.isFinite(value)
        ? Math.max(0, Math.min(1, value))
        : 0;
    }
  }
  return bonuses;
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
    if (row.part === LEGACY_HILL_ROCK_PICK_PART) {
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
  const scoreMult = stats.scoreMult ?? 1;
  return Math.round(
    baseScore * (critical ? stats.criticalMultiplier : 1) * scoreMult,
  );
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
  const scoreMult = stats.scoreMult ?? 1;
  return Math.round(
    baseScore * (critical ? stats.criticalMultiplier : 1) * scoreMult,
  );
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
  const scoreMult = stats.scoreMult ?? 1;
  return Math.round(
    baseScore * (critical ? stats.criticalMultiplier : 1) * scoreMult,
  );
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
      sumUpgradeBonuses(YANMAR_UPGRADE_BONUSES.BUCKET, safeLevels.BUCKET),
    truckCapacityUnits: getYanmarTruckCapacityUnits(safeLevels.TRUCK_CAPACITY),
    truckCooldownSec: getYanmarTruckCooldownSec(safeLevels.TRUCK_SPEED),
    scoreChunkUnits: YANMAR_REWARD_CONFIG.scoreChunkUnits,
    criticalChance:
      YANMAR_REWARD_CONFIG.baseCriticalChance +
      sumUpgradeBonuses(YANMAR_UPGRADE_BONUSES.ARM, safeLevels.ARM),
    criticalMultiplier:
      YANMAR_REWARD_CONFIG.baseCriticalMultiplier +
      sumUpgradeBonuses(YANMAR_UPGRADE_BONUSES.BOOM, safeLevels.BOOM),
    travelSpeedMultiplier:
      1 + sumUpgradeBonuses(YANMAR_UPGRADE_BONUSES.ENGINE, safeLevels.ENGINE),
    workSpeedMultiplier: 1,
    breakerDamage: getYanmarBreakerDamageBonus(safeLevels.CRASH_RESPAWN),
    crashRespawnSec: 5 * 60,
    haulTruckCooldownSec: getYanmarHaulTruckCooldownSec(safeLevels.HAUL_TRUCK_SPEED),
    haulTruckCapacity: YANMAR_BASE_HAUL_TRUCK_CAPACITY,
    hillBoulderCount: YANMAR_BASE_HILL_BOULDER_COUNT,
    gripAdhesionBonus: getYanmarGripAdhesionBonus(safeLevels.GRAPPLE_ADHESION),
    hillSafeLoadChance: getYanmarHillSafeLoadChance(safeLevels.HILL_SAFE_LOAD),
  };
}

/** Upgrade bonus added on top of the 6~10 base roll. */
export function getYanmarBreakerDamageBonus(level = 0) {
  const safeLevel = Math.max(
    0,
    Math.min(YANMAR_EQUIPMENT_CONFIG.CRASH_RESPAWN.maxLevel, Math.floor(level)),
  );
  return sumUpgradeBonuses(YANMAR_UPGRADE_BONUSES.CRASH_RESPAWN, safeLevel);
}

export function formatYanmarBreakerDamage(level = 0) {
  const bonus = getYanmarBreakerDamageBonus(level);
  return `${YANMAR_BASE_BREAKER_DAMAGE_MIN + bonus}~${YANMAR_BASE_BREAKER_DAMAGE_MAX + bonus}`;
}

/** Roll one breaker hit: base 6~10 + upgrade bonus. */
export function rollYanmarBreakerDamage(levelOrBonus = 0, opts?: { bonusOnly?: boolean }) {
  const bonus = opts?.bonusOnly
    ? Math.max(0, Math.floor(levelOrBonus))
    : getYanmarBreakerDamageBonus(levelOrBonus);
  const span =
    YANMAR_BASE_BREAKER_DAMAGE_MAX - YANMAR_BASE_BREAKER_DAMAGE_MIN + 1;
  return (
    YANMAR_BASE_BREAKER_DAMAGE_MIN +
    Math.floor(Math.random() * span) +
    bonus
  );
}

/** Max hit damage at this upgrade level (for numeric summaries). */
export function getYanmarBreakerDamage(level = 0) {
  return YANMAR_BASE_BREAKER_DAMAGE_MAX + getYanmarBreakerDamageBonus(level);
}

export function getYanmarGripAdhesionBonus(level = 0) {
  const safeLevel = Math.max(
    0,
    Math.min(YANMAR_EQUIPMENT_CONFIG.GRAPPLE_ADHESION.maxLevel, Math.floor(level)),
  );
  return sumUpgradeBonuses(YANMAR_UPGRADE_BONUSES.GRAPPLE_ADHESION, safeLevel);
}

export function getYanmarHillSafeLoadChance(level = 0) {
  const safeLevel = Math.max(
    0,
    Math.min(YANMAR_EQUIPMENT_CONFIG.HILL_SAFE_LOAD.maxLevel, Math.floor(level)),
  );
  return Math.min(
    1,
    YANMAR_BASE_HILL_SAFE_LOAD_CHANCE +
      sumUpgradeBonuses(YANMAR_UPGRADE_BONUSES.HILL_SAFE_LOAD, safeLevel),
  );
}

export function getYanmarHaulTruckCooldownSec(level = 0) {
  const safeLevel = Math.max(
    0,
    Math.min(YANMAR_EQUIPMENT_CONFIG.HAUL_TRUCK_SPEED.maxLevel, Math.floor(level)),
  );
  const reduction = sumUpgradeBonuses(
    YANMAR_UPGRADE_BONUSES.HAUL_TRUCK_SPEED,
    safeLevel,
  );
  return Math.max(30, YANMAR_BASE_HAUL_TRUCK_COOLDOWN_SEC - reduction);
}

/** @deprecated 돌 고르기 강화 제거 — 고정 개수 반환 */
export function getYanmarHillBoulderCount(_level = 0) {
  return YANMAR_BASE_HILL_BOULDER_COUNT;
}

export function getYanmarTruckCapacityUnits(capacityLevel = 0) {
  const level = Math.max(
    0,
    Math.min(YANMAR_EQUIPMENT_CONFIG.TRUCK_CAPACITY.maxLevel, Math.floor(capacityLevel)),
  );
  return (
    YANMAR_REWARD_CONFIG.baseTruckCapacityUnits +
    sumUpgradeBonuses(YANMAR_UPGRADE_BONUSES.TRUCK_CAPACITY, level)
  );
}

export function getYanmarTruckCooldownSec(speedLevel = 0) {
  const level = Math.max(
    0,
    Math.min(YANMAR_EQUIPMENT_CONFIG.TRUCK_SPEED.maxLevel, Math.floor(speedLevel)),
  );
  const reduction = sumUpgradeBonuses(YANMAR_UPGRADE_BONUSES.TRUCK_SPEED, level);
  return Math.max(30, YANMAR_REWARD_CONFIG.baseTruckCooldownSec - reduction);
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
    case "HILL_SAFE_LOAD":
      return "재적재";
    default:
      return "";
  }
}

function formatPercentBonus(value: number) {
  const pct = value * 100;
  const rounded = Math.round(pct * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
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
      return `${label}${formatPercentBonus(
        sumUpgradeBonuses(YANMAR_UPGRADE_BONUSES.BOOM, safeLevel),
      )}`;
    case "ARM":
      return `${label}${formatPercentBonus(
        YANMAR_REWARD_CONFIG.baseCriticalChance +
          sumUpgradeBonuses(YANMAR_UPGRADE_BONUSES.ARM, safeLevel),
      )}`;
    case "BUCKET":
      return `${label}${
        YANMAR_REWARD_CONFIG.baseMaxLoadUnits +
        sumUpgradeBonuses(YANMAR_UPGRADE_BONUSES.BUCKET, safeLevel)
      }`;
    case "ENGINE":
      return `${label}${formatPercentBonus(
        sumUpgradeBonuses(YANMAR_UPGRADE_BONUSES.ENGINE, safeLevel),
      )}`;
    case "TRUCK_CAPACITY":
      return `${label}${getYanmarTruckCapacityUnits(safeLevel)}`;
    case "TRUCK_SPEED":
      return `${label}${Math.round(getYanmarTruckCooldownSec(safeLevel))}초`;
    case "CRASH_RESPAWN":
      return `${label}${formatYanmarBreakerDamage(safeLevel)}`;
    case "GRAPPLE_ADHESION":
      return `${label}+${formatPercentBonus(getYanmarGripAdhesionBonus(safeLevel))}`;
    case "HAUL_TRUCK_SPEED":
      return `${label}${Math.round(getYanmarHaulTruckCooldownSec(safeLevel))}초`;
    case "HILL_SAFE_LOAD":
      return `${label}${formatPercentBonus(getYanmarHillSafeLoadChance(safeLevel))}`;
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

/** 1회 강화 시 증가량 — `(+200)` 형태. level = 현재 레벨(다음 단계 보너스). */
export function getYanmarUpgradePartGainText(
  part: YanmarEquipmentPart,
  level = 0,
): string {
  const config = YANMAR_EQUIPMENT_CONFIG[part];
  const nextLevel = Math.max(1, Math.min(config.maxLevel, Math.floor(level) + 1));
  const gain = getUpgradeBonusAtLevel(YANMAR_UPGRADE_BONUSES[part], nextLevel);

  switch (part) {
    case "BOOM":
    case "ARM":
    case "ENGINE":
    case "GRAPPLE_ADHESION":
    case "HILL_SAFE_LOAD":
      return `(+${formatPercentBonus(gain)})`;
    case "BUCKET":
    case "TRUCK_CAPACITY":
    case "CRASH_RESPAWN":
      return `(+${gain})`;
    case "TRUCK_SPEED":
    case "HAUL_TRUCK_SPEED":
      return `(-${gain}초)`;
    default:
      return "";
  }
}

export function getLoadUnits(bucketLoadRatio: number, maxLoadUnits: number) {
  return Math.round(Math.max(0, Math.min(1, bucketLoadRatio)) * maxLoadUnits);
}
