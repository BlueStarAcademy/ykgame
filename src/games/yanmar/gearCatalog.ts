export type GearSlot = "ARM" | "BOOM" | "TRACK" | "BUCKET" | "BREAKER" | "GRAPPLE";
export type ItemGrade = "NORMAL" | "ENHANCED" | "PRECISION" | "MASTER";
export type GachaBanner = "STANDARD" | "PREMIUM";

export const GEAR_SLOTS: readonly GearSlot[] = [
  "ARM",
  "BOOM",
  "TRACK",
  "BUCKET",
  "BREAKER",
  "GRAPPLE",
] as const;

export const GEAR_SLOT_LABEL: Record<GearSlot, string> = {
  ARM: "암",
  BOOM: "붐",
  TRACK: "트랙",
  BUCKET: "버켓",
  BREAKER: "브레이커",
  GRAPPLE: "집게",
};

export const ITEM_GRADE_LABEL: Record<ItemGrade, string> = {
  NORMAL: "일반",
  ENHANCED: "강화",
  PRECISION: "정밀",
  MASTER: "마스터",
};

export const ITEM_GRADE_PREFIX: Record<ItemGrade, string> = {
  NORMAL: "평범한",
  ENHANCED: "개량된",
  PRECISION: "고성능",
  MASTER: "최상급",
};

export const GRADE_SUB_OPTION_COUNT: Record<ItemGrade, number> = {
  NORMAL: 1,
  ENHANCED: 2,
  PRECISION: 3,
  MASTER: 4,
};

/** 주옵션 (2+L+마일스톤)에 곱하는 등급 배율. */
export const GRADE_MAIN_MULT: Record<ItemGrade, number> = {
  NORMAL: 1,
  ENHANCED: 1.3,
  PRECISION: 1.7,
  MASTER: 2.3,
};

/**
 * 주옵션 등급 베이스 flat.
 * rawMain = round((2+L+milestones) * GRADE_MAIN_MULT + GRADE_MAIN_BASE)
 */
export const GRADE_MAIN_BASE: Record<ItemGrade, number> = {
  NORMAL: 3,
  ENHANCED: 6,
  PRECISION: 12,
  MASTER: 22,
};

/** @deprecated Use GRADE_MAIN_BASE */
export const GRADE_MAIN_FLAT = GRADE_MAIN_BASE;

export const GRADE_RANGE_MULT: Record<ItemGrade, number> = {
  NORMAL: 1,
  ENHANCED: 1.35,
  PRECISION: 1.85,
  MASTER: 2.6,
};

export type MainOptionKey =
  | "strength"
  | "agility"
  | "stamina"
  | "endurance"
  | "balance"
  | "technique";

export const MAIN_OPTION_KEYS: readonly MainOptionKey[] = [
  "strength",
  "agility",
  "stamina",
  "endurance",
  "balance",
  "technique",
] as const;

export function isMainOptionKey(value: string): value is MainOptionKey {
  return (MAIN_OPTION_KEYS as readonly string[]).includes(value);
}

export type SubOptionKey = MainOptionKey;

export function isSubOptionKey(value: string): value is SubOptionKey {
  return isMainOptionKey(value);
}

export interface SubOptionDef {
  key: SubOptionKey;
  label: string;
  /** 첫 번째(％) 옵션이 붙을 때 이름 접두어 */
  namePrefix: string;
  /** 첫 옵션(+N%) NORMAL 롤 범위 */
  percentMin: number;
  percentMax: number;
  /** 이후 옵션(+N) NORMAL 롤 범위 */
  flatMin: number;
  flatMax: number;
}

/**
 * 부옵션 = 6능력치.
 * - 첫 번째 슬롯: 항상 +N% → 장비 이름 접두어
 * - 나머지: +N flat
 * - 같은 능력치는 장비 내에서 중복 불가
 */
/** 보조 flat 상한을 낮춰 주옵션이 항상 더 큰 flat을 가지게 한다. */
export const SUB_OPTION_POOL: readonly SubOptionDef[] = [
  {
    key: "strength",
    label: "힘",
    namePrefix: "강한",
    percentMin: 2,
    percentMax: 5,
    flatMin: 1,
    flatMax: 3,
  },
  {
    key: "agility",
    label: "민첩",
    namePrefix: "기민한",
    percentMin: 2,
    percentMax: 5,
    flatMin: 1,
    flatMax: 3,
  },
  {
    key: "stamina",
    label: "지구력",
    namePrefix: "끈질긴",
    percentMin: 2,
    percentMax: 5,
    flatMin: 1,
    flatMax: 3,
  },
  {
    key: "endurance",
    label: "인내",
    namePrefix: "견고한",
    percentMin: 2,
    percentMax: 5,
    flatMin: 1,
    flatMax: 3,
  },
  {
    key: "balance",
    label: "안정",
    namePrefix: "안정된",
    percentMin: 2,
    percentMax: 5,
    flatMin: 1,
    flatMax: 3,
  },
  {
    key: "technique",
    label: "기술",
    namePrefix: "정교한",
    percentMin: 2,
    percentMax: 5,
    flatMin: 1,
    flatMax: 3,
  },
] as const;

/** 구 부옵션 키 → 신규 6능력치 매핑 (기존 장착 아이템 정규화용) */
export const LEGACY_SUB_OPTION_KEY_MAP: Readonly<Record<string, SubOptionKey>> = {
  longReach: "agility",
  powerOutput: "strength",
  heavyFrame: "stamina",
  balanced: "balance",
  liftAssist: "strength",
  extendStroke: "agility",
  sharpEdge: "technique",
  shockAbsorb: "endurance",
  magnetGrip: "balance",
  fuelSaver: "endurance",
  expGain: "technique",
};

export type MasterOptionKey =
  | "soilDumpScorePct"
  | "soilDumpXpPct"
  | "soilDumpGearDrop"
  | "dumpTruckFullScore"
  | "dumpTruckFullGearDrop"
  | "breakerScorePct"
  | "breakerXpPct"
  | "breakerGearDrop"
  | "breakerEvery3HitMult"
  | "hillDumpScorePct"
  | "hillDumpXpPct"
  | "hillDumpGearDrop"
  | "haulTruckFullScore"
  | "haulTruckFullGearDrop";

export interface MasterOptionDef {
  key: MasterOptionKey;
  label: string;
  /** If true, value is fixed and UI hides the chance number */
  hideValue: boolean;
  min: number;
  max: number;
  isPercent: boolean;
  isDropRateBonus: boolean;
}

export const MASTER_OPTION_POOL: readonly MasterOptionDef[] = [
  { key: "soilDumpScorePct", label: "흙 하역 시 획득 점수 추가", hideValue: false, min: 30, max: 50, isPercent: true, isDropRateBonus: false },
  { key: "soilDumpXpPct", label: "흙 하역 시 경험치 추가", hideValue: false, min: 30, max: 50, isPercent: true, isDropRateBonus: false },
  { key: "soilDumpGearDrop", label: "흙 하역 시 장비 획득 확률 증가", hideValue: true, min: 10, max: 10, isPercent: true, isDropRateBonus: true },
  { key: "dumpTruckFullScore", label: "덤프트럭 만재 시 점수 추가", hideValue: false, min: 1000, max: 3000, isPercent: false, isDropRateBonus: false },
  { key: "dumpTruckFullGearDrop", label: "덤프트럭 만재 시 장비 획득 확률 증가", hideValue: true, min: 10, max: 10, isPercent: true, isDropRateBonus: true },
  { key: "breakerScorePct", label: "브레이커 작업 후 점수 추가", hideValue: false, min: 30, max: 50, isPercent: true, isDropRateBonus: false },
  { key: "breakerXpPct", label: "브레이커 작업 후 경험치 추가", hideValue: false, min: 30, max: 50, isPercent: true, isDropRateBonus: false },
  { key: "breakerGearDrop", label: "브레이커 작업 후 장비 획득 확률 증가", hideValue: true, min: 10, max: 10, isPercent: true, isDropRateBonus: true },
  { key: "breakerEvery3HitMult", label: "브레이커 타격 3회마다 데미지 배수", hideValue: false, min: 2, max: 3, isPercent: false, isDropRateBonus: false },
  { key: "hillDumpScorePct", label: "돌 하역 시 점수 추가", hideValue: false, min: 30, max: 50, isPercent: true, isDropRateBonus: false },
  { key: "hillDumpXpPct", label: "돌 하역 시 경험치 추가", hideValue: false, min: 30, max: 50, isPercent: true, isDropRateBonus: false },
  { key: "hillDumpGearDrop", label: "돌 하역 시 장비 획득 확률 증가", hideValue: true, min: 10, max: 10, isPercent: true, isDropRateBonus: true },
  { key: "haulTruckFullScore", label: "돌트럭 만재 시 점수 추가", hideValue: false, min: 1000, max: 3000, isPercent: false, isDropRateBonus: false },
  { key: "haulTruckFullGearDrop", label: "돌트럭 만재 시 장비 획득 확률 증가", hideValue: true, min: 10, max: 10, isPercent: true, isDropRateBonus: true },
] as const;

export interface MainOptionDef {
  key: MainOptionKey;
  label: string;
  /** NORMAL +0 flat bonus before grade mult */
  baseAt0: number;
  /** NORMAL +10 flat bonus before grade mult */
  baseAt10: number;
  isPercent: boolean;
}

/**
 * 부위별 주옵션 = 6능력치 1:1 고정.
 * 파생(적재/속도/크릿/브레이커 등)은 합산 능력치에서 계산.
 */
export const MAIN_OPTION_BY_SLOT: Record<GearSlot, MainOptionDef> = {
  BOOM: { key: "strength", label: "힘", baseAt0: 6, baseAt10: 22, isPercent: false },
  ARM: { key: "endurance", label: "인내", baseAt0: 6, baseAt10: 22, isPercent: false },
  BUCKET: { key: "stamina", label: "지구력", baseAt0: 6, baseAt10: 22, isPercent: false },
  TRACK: { key: "agility", label: "민첩", baseAt0: 6, baseAt10: 22, isPercent: false },
  GRAPPLE: { key: "balance", label: "안정", baseAt0: 6, baseAt10: 22, isPercent: false },
  BREAKER: { key: "technique", label: "기술", baseAt0: 6, baseAt10: 22, isPercent: false },
};

export const WORK_GEAR_DROP_BASE_CHANCE = 0.03;

/** 작업 완료 시 강화코어 독립 드롭 */
export const WORK_CORE_DROP: Record<
  "soilDump" | "breaker" | "hillDump" | "dumpTruckFull" | "haulTruckFull",
  { chance: number; min: number; max: number }
> = {
  soilDump: { chance: 0.08, min: 1, max: 1 },
  breaker: { chance: 0.1, min: 1, max: 2 },
  hillDump: { chance: 0.12, min: 1, max: 2 },
  dumpTruckFull: { chance: 0.15, min: 2, max: 3 },
  haulTruckFull: { chance: 0.15, min: 2, max: 3 },
};

export const WORK_GEAR_DROP_GRADES: { grade: ItemGrade; weight: number }[] = [
  { grade: "NORMAL", weight: 80 },
  { grade: "ENHANCED", weight: 17 },
  { grade: "PRECISION", weight: 2.9 },
  { grade: "MASTER", weight: 0.1 },
];

export const GACHA_CONFIG = {
  STANDARD: {
    cost1: 40,
    cost10: 360,
    grades: [
      { grade: "NORMAL" as ItemGrade, weight: 72 },
      { grade: "ENHANCED" as ItemGrade, weight: 23 },
      { grade: "PRECISION" as ItemGrade, weight: 5 },
    ],
  },
  PREMIUM: {
    cost1: 120,
    cost10: 1080,
    grades: [
      { grade: "ENHANCED" as ItemGrade, weight: 62 },
      { grade: "PRECISION" as ItemGrade, weight: 33 },
      { grade: "MASTER" as ItemGrade, weight: 5 },
    ],
  },
} as const;

export const GEAR_INVENTORY_BASE = 40;
export const GEAR_INVENTORY_MAX = 200;
export const GEAR_INVENTORY_EXPAND_STEP = 10;
/** Costs for successive +10 expansions after base. Index 4+ stay at 300. */
export const GEAR_INVENTORY_EXPAND_COSTS = [100, 150, 200, 250, 300] as const;
/** @deprecated use GEAR_INVENTORY_MAX / per-user gearInventorySlots */
export const GEAR_INVENTORY_CAP = GEAR_INVENTORY_MAX;

export function clampGearInventorySlots(slots: number): number {
  if (!Number.isFinite(slots)) return GEAR_INVENTORY_BASE;
  return Math.max(
    GEAR_INVENTORY_BASE,
    Math.min(GEAR_INVENTORY_MAX, Math.floor(slots)),
  );
}

/** Stars to unlock the next +10 slots, or null if already at max. */
export function getGearInventoryExpandCost(currentSlots: number): number | null {
  const slots = clampGearInventorySlots(currentSlots);
  if (slots >= GEAR_INVENTORY_MAX) return null;
  const next = Math.min(GEAR_INVENTORY_MAX, slots + GEAR_INVENTORY_EXPAND_STEP);
  if (next <= slots) return null;
  const index = Math.max(
    0,
    Math.floor((slots - GEAR_INVENTORY_BASE) / GEAR_INVENTORY_EXPAND_STEP),
  );
  if (index < GEAR_INVENTORY_EXPAND_COSTS.length) {
    return GEAR_INVENTORY_EXPAND_COSTS[index];
  }
  return 300;
}

export const EXP_GAIN_SUB_CAP = 0.3; // reserved; ability subs no longer grant XP
/** @deprecated dismantle no longer refunds stars */
export const ENHANCE_DISMANTLE_REFUND_RATE = 0;

/** @deprecated Use FREE_REPAIR_COOLDOWN_MS from maintenance.ts */
export {
  FREE_REPAIR_COOLDOWN_MS,
  PREMIUM_REPAIR_BUFF_MS as SMALL_REPAIR_BUFF_MS,
  TOP_REPAIR_BUFF_MS as LARGE_REPAIR_BUFF_MS,
  TOP_REPAIR_COST as LARGE_REPAIR_COST,
  PREMIUM_REPAIR_COST,
  TOP_REPAIR_COST,
} from "./maintenance";

export {
  MAINTENANCE_FLUID_IDS,
  MAINTENANCE_FLUIDS,
  MAINTENANCE_WARN_RATIO,
  getRepairLabels,
  isMaintenanceFluidId,
  type MaintenanceFluidId,
  type MaintenanceRepairKind,
} from "./maintenance";

/** NORMAL 기준 강화 스타 (+1~+10) */
export const ENHANCE_STAR_COSTS_NORMAL = [
  10, 20, 30, 40, 50, 75, 100, 125, 150, 200,
] as const;

/** NORMAL 기준 강화코어 (+1~+10). +1~+2 = 0, +3부터 체증 */
export const ENHANCE_CORE_COSTS_NORMAL = [
  0, 0, 1, 2, 3, 5, 7, 10, 14, 20,
] as const;

/** 등급별 비용 배율 (≈1.5배씩) */
export const GRADE_COST_MULT: Record<ItemGrade, number> = {
  NORMAL: 1,
  ENHANCED: 1.5,
  PRECISION: 2.25,
  MASTER: 3.375,
};

/** 등급별 기본 성공률 배율 */
export const GRADE_SUCCESS_MULT: Record<ItemGrade, number> = {
  NORMAL: 1,
  ENHANCED: 0.9,
  PRECISION: 0.8,
  MASTER: 0.7,
};

/** 등급별 실패 시 성공률 가산 배율 */
export const GRADE_FAIL_BONUS_MULT: Record<ItemGrade, number> = {
  NORMAL: 1,
  ENHANCED: 0.75,
  PRECISION: 0.5,
  MASTER: 0.35,
};

export const DISMANTLE_CORE_GRADE_BASE: Record<ItemGrade, number> = {
  NORMAL: 2,
  ENHANCED: 4,
  PRECISION: 8,
  MASTER: 16,
};

/** +0 ~ +10 */
export const DISMANTLE_CORE_ENHANCE_BONUS = [
  0, 1, 2, 4, 6, 9, 13, 18, 25, 34, 45,
] as const;

export function smallRepairCost(tier: number) {
  return 20 + 15 * tier;
}

export const MILESTONE_K: Record<number, number> = {
  3: 1,
  6: 2,
  9: 3,
  10: 4,
};

/**
 * Cumulative flat main-stat bonuses unlocked at enhance milestones.
 * @deprecated Use MILESTONE_MAIN_FLAT (same integer values).
 */
export const MILESTONE_MAIN_BONUS: Record<number, number> = {
  3: 1,
  6: 2,
  9: 4,
  10: 6,
};

/** Flat main-stat bonuses at milestones (integer system, cumulative). */
export const MILESTONE_MAIN_FLAT: Record<number, number> = {
  3: 1,
  6: 2,
  9: 4,
  10: 6,
};

export const REPAIR_TENT = {
  x: -45,
  z: -42,
  radius: 14,
  /** Yaw so the bay-door facade faces the worksite / spawn approach. */
  rotationY: Math.atan2(27, 20),
} as const;

/** 장비 판매 시 등급별 스타 환급. */
export const SELL_STARS_BY_GRADE: Record<ItemGrade, number> = {
  NORMAL: 5,
  ENHANCED: 10,
  PRECISION: 20,
  MASTER: 100,
};

/** 합성 시 한 단계 상위 등급이 나올 확률 (나머지는 동일 등급). 마스터는 0. */
export const SYNTH_UPGRADE_CHANCE: Record<ItemGrade, number> = {
  NORMAL: 0.5,
  ENHANCED: 0.3,
  PRECISION: 0.1,
  MASTER: 0,
};

export const SYNTH_NEXT_GRADE: Record<ItemGrade, ItemGrade | null> = {
  NORMAL: "ENHANCED",
  ENHANCED: "PRECISION",
  PRECISION: "MASTER",
  MASTER: null,
};

export function rollSynthesizeResultGrade(inputGrade: ItemGrade): ItemGrade {
  const next = SYNTH_NEXT_GRADE[inputGrade];
  if (!next) return inputGrade;
  return Math.random() < SYNTH_UPGRADE_CHANCE[inputGrade] ? next : inputGrade;
}
