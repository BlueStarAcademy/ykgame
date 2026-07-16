import type { ChassisBaseStats, ChassisClass } from "./chassisCatalog";
import { MAIN_OPTION_KEYS, type MainOptionKey } from "./gearCatalog";

export type AbilityAlloc = ChassisBaseStats;

export const EMPTY_ABILITY_ALLOC: AbilityAlloc = {
  strength: 0,
  agility: 0,
  stamina: 0,
  endurance: 0,
  balance: 0,
  technique: 0,
};

const ABILITY_LABEL: Record<MainOptionKey, string> = {
  strength: "힘",
  agility: "민첩",
  stamina: "지구력",
  endurance: "인내",
  balance: "안정",
  technique: "기술",
};

export function abilityLabel(key: MainOptionKey): string {
  return ABILITY_LABEL[key];
}

export function emptyAbilityAlloc(): AbilityAlloc {
  return { ...EMPTY_ABILITY_ALLOC };
}

export function parseAbilityAlloc(raw: unknown): AbilityAlloc {
  const out = emptyAbilityAlloc();
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;
  for (const key of MAIN_OPTION_KEYS) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out[key] = Math.floor(v);
    }
  }
  return out;
}

export function spentAbilityPoints(alloc: AbilityAlloc): number {
  return MAIN_OPTION_KEYS.reduce((sum, key) => sum + alloc[key], 0);
}

export function abilityPointsSummary(playerLevel: number, alloc: AbilityAlloc) {
  const total = Math.max(0, Math.floor(playerLevel));
  const spent = spentAbilityPoints(alloc);
  return {
    total,
    spent,
    remaining: Math.max(0, total - spent),
  };
}

/** Validate and clamp alloc so each ≥0 int and sum ≤ playerLevel. */
export function sanitizeAbilityAlloc(
  raw: unknown,
  playerLevel: number,
): AbilityAlloc | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const out = emptyAbilityAlloc();
  for (const key of MAIN_OPTION_KEYS) {
    const v = obj[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || !Number.isInteger(v)) {
      return null;
    }
    out[key] = v;
  }
  const total = Math.max(0, Math.floor(playerLevel));
  if (spentAbilityPoints(out) > total) return null;
  return out;
}

type WeightMap = Partial<Record<MainOptionKey, number>>;

const CLASS_WEIGHTS: Record<ChassisClass, WeightMap> = {
  LIGHT: { agility: 0.5, balance: 0.25, technique: 0.25 },
  MEDIUM: { strength: 0.25, agility: 0.25, technique: 0.25, balance: 0.25 },
  HEAVY: { strength: 0.4, endurance: 0.3, stamina: 0.3 },
};

/** Largest-remainder distribution so integers sum exactly to `total`. */
export function recommendAbilityAlloc(
  playerLevel: number,
  chassisClass: ChassisClass,
): AbilityAlloc {
  const total = Math.max(0, Math.floor(playerLevel));
  const weights = CLASS_WEIGHTS[chassisClass];
  const keys = MAIN_OPTION_KEYS.filter((k) => (weights[k] ?? 0) > 0);
  const out = emptyAbilityAlloc();
  if (total === 0 || keys.length === 0) return out;

  const exact = keys.map((key) => ({
    key,
    exact: total * (weights[key] ?? 0),
  }));
  let assigned = 0;
  for (const row of exact) {
    const floor = Math.floor(row.exact);
    out[row.key] = floor;
    assigned += floor;
  }
  let remain = total - assigned;
  const byFrac = [...exact].sort(
    (a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)),
  );
  for (const row of byFrac) {
    if (remain <= 0) break;
    out[row.key] += 1;
    remain -= 1;
  }
  return out;
}

export function addAbilityAlloc(
  base: ChassisBaseStats,
  alloc: AbilityAlloc | null | undefined,
): ChassisBaseStats {
  if (!alloc) return { ...base };
  return {
    strength: base.strength + alloc.strength,
    agility: base.agility + alloc.agility,
    stamina: base.stamina + alloc.stamina,
    endurance: base.endurance + alloc.endurance,
    balance: base.balance + alloc.balance,
    technique: base.technique + alloc.technique,
  };
}
