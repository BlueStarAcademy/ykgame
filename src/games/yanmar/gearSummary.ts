import {
  GEAR_SLOTS,
  MAIN_OPTION_BY_SLOT,
  SUB_OPTION_POOL,
  type GearSlot,
  type ItemGrade,
  type SubOptionKey,
} from "./gearCatalog";

export interface GearSummaryItem {
  id: string;
  slot: GearSlot;
  grade: ItemGrade;
  enhanceLevel: number;
  nameSnapshot: string;
  durability: number;
  durabilityMax: number;
  mainOption: { key: string; value: number };
  mainLabel?: string;
  subOptions: { key: string; value: number; isPercent?: boolean }[];
  masterOption: {
    label: string;
    value: number;
    hideValue: boolean;
    isPercent: boolean;
  } | null;
  equippedSlot: GearSlot | null;
}

export interface GearOptionTotals {
  mainBySlot: Partial<
    Record<GearSlot, { label: string; value: number; enhanceLevel: number }>
  >;
  subTotals: {
    key: SubOptionKey;
    label: string;
    value: number;
    isPercent: boolean;
  }[];
  masters: {
    label: string;
    value: number;
    hideValue: boolean;
    isPercent: boolean;
  }[];
}

export function summarizeEquippedGear(items: GearSummaryItem[]): GearOptionTotals {
  const equipped = items.filter((i) => i.equippedSlot != null);
  const mainBySlot: GearOptionTotals["mainBySlot"] = {};
  const subMap = new Map<string, {
    key: SubOptionKey;
    label: string;
    value: number;
    isPercent: boolean;
  }>();
  const masters: GearOptionTotals["masters"] = [];

  for (const item of equipped) {
    const def = MAIN_OPTION_BY_SLOT[item.slot];
    mainBySlot[item.slot] = {
      label: item.mainLabel ?? def.label,
      value: item.mainOption.value,
      enhanceLevel: item.enhanceLevel,
    };
    for (const sub of item.subOptions) {
      const key = sub.key as SubOptionKey;
      const isPercent = Boolean(sub.isPercent);
      const mapKey = `${key}:${isPercent ? "pct" : "flat"}`;
      const poolDef = SUB_OPTION_POOL.find((s) => s.key === key);
      const prev = subMap.get(mapKey);
      subMap.set(mapKey, {
        key,
        label: poolDef?.label ?? key,
        value: (prev?.value ?? 0) + sub.value,
        isPercent,
      });
    }
    if (item.masterOption) {
      masters.push({
        label: item.masterOption.label,
        value: item.masterOption.value,
        hideValue: item.masterOption.hideValue,
        isPercent: item.masterOption.isPercent,
      });
    }
  }

  const subTotals = [...subMap.values()].sort((a, b) => {
    if (a.isPercent !== b.isPercent) return a.isPercent ? -1 : 1;
    return b.value - a.value;
  });

  return { mainBySlot, subTotals, masters };
}

export function equippedBySlot<T extends GearSummaryItem>(
  items: T[],
): Record<GearSlot, T | null> {
  const map = Object.fromEntries(GEAR_SLOTS.map((s) => [s, null])) as Record<
    GearSlot,
    T | null
  >;
  for (const item of items) {
    if (item.equippedSlot) {
      map[item.equippedSlot] = item;
    }
  }
  return map;
}

export function formatChassisStatLines(stats: {
  strength: number;
  agility: number;
  stamina: number;
  endurance: number;
  balance: number;
  technique: number;
}) {
  return [
    { label: "힘", value: stats.strength },
    { label: "민첩", value: stats.agility },
    { label: "지구력", value: stats.stamina },
    { label: "인내", value: stats.endurance },
    { label: "안정", value: stats.balance },
    { label: "기술", value: stats.technique },
  ];
}

export function formatDerivedStatLines(stats: {
  maxLoadUnits: number;
  travelSpeedMultiplier: number;
  workSpeedMultiplier?: number;
  criticalChance: number;
  breakerDamage: number;
}) {
  return [
    { label: "적재량", value: Math.round(stats.maxLoadUnits) },
    {
      label: "이동속도",
      value: `${Math.round(stats.travelSpeedMultiplier * 100)}%`,
    },
    {
      label: "작업속도",
      value: `${Math.round((stats.workSpeedMultiplier ?? 1) * 100)}%`,
    },
    {
      label: "크리티컬",
      value: `${(stats.criticalChance * 100).toFixed(1)}%`,
    },
    {
      label: "브레이커",
      value: `+${stats.breakerDamage}`,
    },
  ];
}
