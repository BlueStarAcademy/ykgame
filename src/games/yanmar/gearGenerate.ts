import {
  GEAR_SLOTS,
  GEAR_SLOT_LABEL,
  GRADE_MAIN_BASE,
  GRADE_MAIN_MULT,
  GRADE_RANGE_MULT,
  GRADE_SUB_OPTION_COUNT,
  GRADE_COST_MULT,
  GRADE_SUCCESS_MULT,
  GRADE_FAIL_BONUS_MULT,
  ENHANCE_STAR_COSTS_NORMAL,
  ENHANCE_CORE_COSTS_NORMAL,
  DISMANTLE_CORE_GRADE_BASE,
  DISMANTLE_CORE_ENHANCE_BONUS,
  ITEM_GRADE_PREFIX,
  LEGACY_SUB_OPTION_KEY_MAP,
  MAIN_OPTION_BY_SLOT,
  MASTER_OPTION_POOL,
  MILESTONE_K,
  MILESTONE_MAIN_FLAT,
  SUB_OPTION_POOL,
  isSubOptionKey,
  type GearSlot,
  type ItemGrade,
  type MainOptionKey,
  type MasterOptionKey,
  type SubOptionKey,
} from "./gearCatalog";
import { YANMAR_UPGRADE_ATTEMPT } from "./equipment";

export interface SubOptionInst {
  key: SubOptionKey;
  /** true = +N% (항상 첫 번째 옵션), false = +N flat */
  isPercent: boolean;
  tier: number;
  value: number;
  rollMin: number;
  rollMax: number;
  rolls: number[];
}

export interface MainOptionInst {
  key: MainOptionKey;
  value: number;
  baseAtLevel: number;
}

export interface MasterOptionInst {
  key: MasterOptionKey;
  value: number;
  label: string;
  hideValue: boolean;
  isPercent: boolean;
  isDropRateBonus: boolean;
}

export interface GearItemData {
  slot: GearSlot;
  grade: ItemGrade;
  enhanceLevel: number;
  failBonus: number;
  mainOption: MainOptionInst;
  subOptions: SubOptionInst[];
  masterOption: MasterOptionInst | null;
  nameSnapshot: string;
  durability: number;
  durabilityMax: number;
}

function rand() {
  return Math.random();
}

function rollFloat(min: number, max: number) {
  return min + rand() * (max - min);
}

function rollInt(min: number, max: number) {
  return Math.floor(rollFloat(min, max + 1 - Number.EPSILON));
}

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rand() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1]!;
}

export function pickGrade(weights: { grade: ItemGrade; weight: number }[]): ItemGrade {
  return pickWeighted(weights).grade;
}

export function pickSlot(): GearSlot {
  return GEAR_SLOTS[Math.floor(rand() * GEAR_SLOTS.length)]!;
}

function resolveSubKey(raw: string): SubOptionKey | null {
  if (isSubOptionKey(raw)) return raw;
  return LEGACY_SUB_OPTION_KEY_MAP[raw] ?? null;
}

function subRange(
  key: SubOptionKey,
  grade: ItemGrade,
  isPercent: boolean,
): { min: number; max: number } {
  const def = SUB_OPTION_POOL.find((s) => s.key === key)!;
  const m = GRADE_RANGE_MULT[grade];
  const baseMin = isPercent ? def.percentMin : def.flatMin;
  const baseMax = isPercent ? def.percentMax : def.flatMax;
  const min = Math.max(1, Math.round(baseMin * m));
  const max = Math.max(min, Math.round(baseMax * m));
  return { min, max };
}

export function createSubOption(
  key: SubOptionKey,
  grade: ItemGrade,
  isPercent: boolean,
): SubOptionInst {
  const { min, max } = subRange(key, grade, isPercent);
  const roll = rollInt(min, max);
  return {
    key,
    isPercent,
    tier: 1,
    value: roll,
    rollMin: min,
    rollMax: max,
    rolls: [roll],
  };
}

export function tierUpSubOption(sub: SubOptionInst): SubOptionInst {
  const min = Math.max(1, Math.round(sub.rollMin));
  const max = Math.max(min, Math.round(sub.rollMax));
  const roll = rollInt(min, max);
  const rolls = [...sub.rolls.map((r) => Math.max(1, Math.round(r))), roll];
  return {
    ...sub,
    tier: sub.tier + 1,
    value: rolls.reduce((a, b) => a + b, 0),
    rollMin: min,
    rollMax: max,
    rolls,
  };
}

function milestoneFlatSum(level: number): number {
  let sum = 0;
  for (const [lv, bonus] of Object.entries(MILESTONE_MAIN_FLAT)) {
    if (level >= Number(lv)) sum += bonus;
  }
  return sum;
}

function rawMainAtLevel(grade: ItemGrade, level: number): number {
  const scaled = (2 + level + milestoneFlatSum(level)) * GRADE_MAIN_MULT[grade];
  return Math.round(scaled + GRADE_MAIN_BASE[grade]);
}

/**
 * Deterministic integer main option at enhance level.
 * Guarantees each level is at least +1 over the previous level.
 */
export function rollMainAtLevel(
  slot: GearSlot,
  grade: ItemGrade,
  level: number,
): number {
  void slot; // slot only selects which main key; magnitude is shared across slots
  const L = Math.max(0, Math.min(10, Math.floor(level)));
  let value = rawMainAtLevel(grade, 0);
  for (let lv = 1; lv <= L; lv += 1) {
    value = Math.max(rawMainAtLevel(grade, lv), value + 1);
  }
  return value;
}

/** 주옵션을 부위·강화단계 기준 정수 공식으로 재계산한다. */
export function canonicalizeMainOption(
  slot: GearSlot,
  grade: ItemGrade,
  enhanceLevel: number,
  _main?: Partial<MainOptionInst> | null | undefined,
): MainOptionInst {
  void _main;
  const def = MAIN_OPTION_BY_SLOT[slot];
  const value = rollMainAtLevel(slot, grade, enhanceLevel);
  return { key: def.key, value, baseAtLevel: value };
}

/** 부옵션 수치를 정수로 정규화한다. */
export function canonicalizeSubOption(
  sub: Partial<SubOptionInst> & { key: string },
  index = 0,
): SubOptionInst | null {
  const key = resolveSubKey(String(sub.key));
  if (!key) return null;
  const isPercent =
    typeof sub.isPercent === "boolean" ? sub.isPercent : index === 0;
  const rollMin = Math.max(1, Math.round(Number(sub.rollMin) || 1));
  const rollMax = Math.max(rollMin, Math.round(Number(sub.rollMax) || rollMin));
  const rawRolls = Array.isArray(sub.rolls)
    ? sub.rolls.map((r) => Math.max(1, Math.round(Number(r) || 1)))
    : [];
  const valueFromRolls =
    rawRolls.length > 0 ? rawRolls.reduce((a, b) => a + b, 0) : null;
  const value = Math.max(
    1,
    Math.round(
      typeof sub.value === "number" && Number.isFinite(sub.value)
        ? sub.value
        : (valueFromRolls ?? rollMin),
    ),
  );
  return {
    key,
    isPercent,
    tier: Math.max(1, Math.floor(Number(sub.tier) || 1)),
    value,
    rollMin,
    rollMax,
    rolls: rawRolls.length > 0 ? rawRolls : [value],
  };
}

export function canonicalizeSubOptions(subs: unknown): SubOptionInst[] {
  if (!Array.isArray(subs)) return [];
  const out: SubOptionInst[] = [];
  const seen = new Set<SubOptionKey>();
  for (const raw of subs) {
    if (!raw || typeof raw !== "object" || !("key" in raw)) continue;
    const next = canonicalizeSubOption(
      raw as Partial<SubOptionInst> & { key: string },
      out.length,
    );
    if (!next) continue;
    if (seen.has(next.key)) continue;
    seen.add(next.key);
    // 첫 번째만 % — 이후는 flat으로 강제 (레거시/손상 데이터 보정)
    out.push({
      ...next,
      isPercent: out.length === 0,
    });
  }
  return out;
}

/** 첫 번째 부옵션(+N%)의 접두어로 이름을 만든다. */
export function buildItemName(
  grade: ItemGrade,
  subs: SubOptionInst[],
  slot: GearSlot,
): string {
  const gradePrefix = ITEM_GRADE_PREFIX[grade];
  const first = subs[0];
  const def =
    (first && SUB_OPTION_POOL.find((s) => s.key === first.key)) ||
    SUB_OPTION_POOL.find((s) => s.key === "balance")!;
  return `${gradePrefix} ${def.namePrefix} ${GEAR_SLOT_LABEL[slot]}`;
}

export function rollMasterOption(): MasterOptionInst {
  const def = MASTER_OPTION_POOL[Math.floor(rand() * MASTER_OPTION_POOL.length)]!;
  const value =
    def.min === def.max
      ? def.min
      : def.key === "breakerEvery3HitMult"
        ? rollFloat(def.min, def.max)
        : rollInt(def.min, def.max);
  return {
    key: def.key,
    value,
    label: def.label,
    hideValue: def.hideValue,
    isPercent: def.isPercent,
    isDropRateBonus: def.isDropRateBonus,
  };
}

function shuffleKeys<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function createGearItem(
  slot: GearSlot,
  grade: ItemGrade,
  durabilityMax: number,
): GearItemData {
  const count = GRADE_SUB_OPTION_COUNT[grade];
  const pool = shuffleKeys([...SUB_OPTION_POOL]);
  const subs: SubOptionInst[] = [];
  for (let i = 0; i < count; i += 1) {
    const picked = pool[i];
    if (!picked) break;
    // 첫 옵션은 항상 +N%, 이후는 +N
    subs.push(createSubOption(picked.key, grade, i === 0));
  }
  if (subs.length === 0) {
    subs.push(createSubOption("balance", grade, true));
  }
  const mainValue = rollMainAtLevel(slot, grade, 0);
  return {
    slot,
    grade,
    enhanceLevel: 0,
    failBonus: 0,
    mainOption: {
      key: MAIN_OPTION_BY_SLOT[slot].key,
      value: mainValue,
      baseAtLevel: mainValue,
    },
    subOptions: subs,
    masterOption: grade === "MASTER" ? rollMasterOption() : null,
    nameSnapshot: buildItemName(grade, subs, slot),
    durability: durabilityMax,
    durabilityMax,
  };
}

export function createStarterGear(slot: GearSlot, durabilityMax: number): GearItemData {
  const grade: ItemGrade = "NORMAL";
  const sub = createSubOption("balance", grade, true);
  const mainValue = rollMainAtLevel(slot, grade, 0);
  return {
    slot,
    grade,
    enhanceLevel: 0,
    failBonus: 0,
    mainOption: {
      key: MAIN_OPTION_BY_SLOT[slot].key,
      value: mainValue,
      baseAtLevel: mainValue,
    },
    subOptions: [sub],
    masterOption: null,
    nameSnapshot: buildItemName(grade, [sub], slot),
    durability: durabilityMax,
    durabilityMax,
  };
}

function scaleByGrade(base: number, grade: ItemGrade): number {
  return Math.ceil(base * GRADE_COST_MULT[grade]);
}

export function getEnhanceCost(
  nextLevel: number,
  grade: ItemGrade = "NORMAL",
): number | null {
  if (nextLevel < 1 || nextLevel > 10) return null;
  return scaleByGrade(ENHANCE_STAR_COSTS_NORMAL[nextLevel - 1]!, grade);
}

/** +1~+2: 0코어, +3부터 NORMAL 기준 체증 × 등급 1.5배 */
export function getEnhanceCoreCost(
  nextLevel: number,
  grade: ItemGrade = "NORMAL",
): number {
  if (nextLevel < 1 || nextLevel > 10) return 0;
  return scaleByGrade(ENHANCE_CORE_COSTS_NORMAL[nextLevel - 1]!, grade);
}

export function getEnhanceSuccessRate(
  nextLevel: number,
  failBonus: number,
  grade: ItemGrade = "NORMAL",
) {
  if (nextLevel < 1 || nextLevel > 10) return 0;
  const row = YANMAR_UPGRADE_ATTEMPT[nextLevel - 1]!;
  const base = row.successRate * GRADE_SUCCESS_MULT[grade];
  return Math.min(1, Math.max(0, base + Math.max(0, failBonus)));
}

export function getEnhanceFailBonusAdd(
  nextLevel: number,
  grade: ItemGrade = "NORMAL",
): number {
  if (nextLevel < 1 || nextLevel > 10) return 0;
  const row = YANMAR_UPGRADE_ATTEMPT[nextLevel - 1];
  const add = row?.failBonus ?? 0;
  return add * GRADE_FAIL_BONUS_MULT[grade];
}

export function previewMainAtLevel(
  slot: GearSlot,
  grade: ItemGrade,
  level: number,
): number {
  return rollMainAtLevel(slot, grade, level);
}

export type MilestonePreview =
  | { kind: "none" }
  | { kind: "newSubs"; count: number }
  | { kind: "tierUp"; count: number };

export function getMilestonePreview(
  nextLevel: number,
  currentSubCount: number,
): MilestonePreview {
  const K = MILESTONE_K[nextLevel];
  if (!K) return { kind: "none" };
  if (currentSubCount < K) {
    return { kind: "newSubs", count: K - currentSubCount };
  }
  return { kind: "tierUp", count: K };
}

export function getDismantleEnhanceCores(
  grade: ItemGrade,
  enhanceLevel: number,
): number {
  const lv = Math.max(0, Math.min(10, Math.floor(enhanceLevel)));
  return (
    DISMANTLE_CORE_GRADE_BASE[grade] + (DISMANTLE_CORE_ENHANCE_BONUS[lv] ?? 0)
  );
}

export function applyMilestoneSubs(
  item: GearItemData,
  reachedLevel: number,
): GearItemData {
  const K = MILESTONE_K[reachedLevel];
  if (!K) return item;
  let subs = item.subOptions.map((s) => ({ ...s, rolls: [...s.rolls] }));
  const N = subs.length;
  if (N >= K) {
    const indices = [...subs.keys()];
    for (let i = indices.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [indices[i], indices[j]] = [indices[j]!, indices[i]!];
    }
    for (let i = 0; i < K; i += 1) {
      const idx = indices[i]!;
      subs[idx] = tierUpSubOption(subs[idx]!);
    }
  } else {
    const need = K - N;
    const used = new Set(subs.map((s) => s.key));
    const avail = shuffleKeys(SUB_OPTION_POOL.filter((s) => !used.has(s.key)));
    for (let i = 0; i < need && i < avail.length; i += 1) {
      const picked = avail[i]!;
      // 추가 부옵션은 항상 flat (+N). 첫 %는 생성 시 이미 존재.
      subs.push(createSubOption(picked.key, item.grade, false));
    }
  }
  return {
    ...item,
    subOptions: subs,
    nameSnapshot: buildItemName(item.grade, subs, item.slot),
    mainOption: {
      ...item.mainOption,
      value: rollMainAtLevel(item.slot, item.grade, item.enhanceLevel),
      baseAtLevel: rollMainAtLevel(item.slot, item.grade, item.enhanceLevel),
    },
  };
}

export function applyEnhanceSuccess(item: GearItemData): GearItemData {
  const nextLevel = item.enhanceLevel + 1;
  let next: GearItemData = {
    ...item,
    enhanceLevel: nextLevel,
    failBonus: 0,
    mainOption: {
      ...item.mainOption,
      value: rollMainAtLevel(item.slot, item.grade, nextLevel),
      baseAtLevel: rollMainAtLevel(item.slot, item.grade, nextLevel),
    },
  };
  if (MILESTONE_K[nextLevel]) {
    next = applyMilestoneSubs(next, nextLevel);
  }
  // MASTER +10: 마스터옵션 활성 계수 +1단
  if (nextLevel === 10 && item.grade === "MASTER" && next.masterOption) {
    const m = next.masterOption;
    next = {
      ...next,
      masterOption: {
        ...m,
        value: m.isDropRateBonus
          ? m.value + 10
          : m.key === "breakerEvery3HitMult"
            ? Math.round((m.value + 0.25) * 100) / 100
            : Math.round(m.value * 1.25),
      },
    };
  }
  return next;
}

export function applyEnhanceFail(item: GearItemData): GearItemData {
  const nextLevel = item.enhanceLevel + 1;
  const add = getEnhanceFailBonusAdd(nextLevel, item.grade);
  return {
    ...item,
    failBonus: Math.min(1, item.failBonus + add),
  };
}

export function starsSpentOnEnhance(
  level: number,
  grade: ItemGrade = "NORMAL",
) {
  let sum = 0;
  for (let i = 1; i <= level && i <= 10; i += 1) {
    sum += getEnhanceCost(i, grade) ?? 0;
  }
  return sum;
}

export function resolveMaxMasterByKey(
  options: (MasterOptionInst | null | undefined)[],
): Map<MasterOptionKey, MasterOptionInst> {
  const map = new Map<MasterOptionKey, MasterOptionInst>();
  for (const opt of options) {
    if (!opt) continue;
    const prev = map.get(opt.key);
    if (!prev || opt.value > prev.value) map.set(opt.key, opt);
  }
  return map;
}
