export type ChassisClass = "LIGHT" | "MEDIUM" | "HEAVY";

export type ChassisModelId =
  | "SV08_1C"
  | "SV10"
  | "SV11"
  | "ViO12_2A"
  | "ViO17_1"
  | "ViO20_6"
  | "ViO23_6"
  | "ViO25_6A"
  | "ViO35_74"
  | "ViO35_7A_CJR"
  | "ViO55_6A"
  | "ViO80_7"
  | "SV100_7";

export interface ChassisBaseStats {
  strength: number;
  agility: number;
  stamina: number;
  endurance: number;
  balance: number;
  technique: number;
}

export interface ChassisDef {
  id: ChassisModelId;
  label: string;
  chassisClass: ChassisClass;
  tier: 1 | 2 | 3;
  priceStars: number;
  /** 0 = always unlockable to buy; else min player level */
  unlockLevel: number;
  /** Default owned, no purchase */
  granted: boolean;
  stats: ChassisBaseStats;
  trait: string;
}

export const CHASSIS_CLASS_LABEL: Record<ChassisClass, string> = {
  LIGHT: "경량",
  MEDIUM: "중형",
  HEAVY: "대형",
};

export const CHASSIS_CATALOG: readonly ChassisDef[] = [
  {
    id: "SV08_1C",
    label: "SV08-1C",
    chassisClass: "LIGHT",
    tier: 1,
    priceStars: 1000,
    unlockLevel: 0,
    granted: false,
    stats: { strength: 8, agility: 18, stamina: 10, endurance: 8, balance: 14, technique: 14 },
    trait: "최기동",
  },
  {
    id: "SV10",
    label: "SV10",
    chassisClass: "LIGHT",
    tier: 1,
    priceStars: 1000,
    unlockLevel: 0,
    granted: false,
    stats: { strength: 10, agility: 16, stamina: 11, endurance: 9, balance: 15, technique: 11 },
    trait: "접지·안정",
  },
  {
    id: "SV11",
    label: "SV11",
    chassisClass: "LIGHT",
    tier: 1,
    priceStars: 1000,
    unlockLevel: 0,
    granted: false,
    stats: { strength: 11, agility: 15, stamina: 11, endurance: 10, balance: 12, technique: 13 },
    trait: "기술 특화",
  },
  {
    id: "ViO12_2A",
    label: "ViO12-2A",
    chassisClass: "LIGHT",
    tier: 1,
    priceStars: 1000,
    unlockLevel: 0,
    granted: false,
    stats: { strength: 12, agility: 14, stamina: 12, endurance: 11, balance: 12, technique: 11 },
    trait: "경량 균형",
  },
  {
    id: "ViO17_1",
    label: "ViO17-1",
    chassisClass: "MEDIUM",
    tier: 2,
    priceStars: 0,
    unlockLevel: 0,
    granted: true,
    stats: { strength: 14, agility: 14, stamina: 14, endurance: 14, balance: 14, technique: 14 },
    trait: "기본 지급/균형",
  },
  {
    id: "ViO20_6",
    label: "ViO20-6",
    chassisClass: "MEDIUM",
    tier: 2,
    priceStars: 2000,
    unlockLevel: 20,
    granted: false,
    stats: { strength: 18, agility: 13, stamina: 14, endurance: 14, balance: 13, technique: 12 },
    trait: "힘·적재",
  },
  {
    id: "ViO23_6",
    label: "ViO23-6",
    chassisClass: "MEDIUM",
    tier: 2,
    priceStars: 2000,
    unlockLevel: 20,
    granted: false,
    stats: { strength: 15, agility: 12, stamina: 14, endurance: 14, balance: 17, technique: 12 },
    trait: "안정 특화",
  },
  {
    id: "ViO25_6A",
    label: "ViO25-6A",
    chassisClass: "MEDIUM",
    tier: 2,
    priceStars: 2000,
    unlockLevel: 20,
    granted: false,
    stats: { strength: 16, agility: 12, stamina: 16, endurance: 16, balance: 13, technique: 11 },
    trait: "지구력·인내",
  },
  {
    id: "ViO35_74",
    label: "ViO35-74",
    chassisClass: "HEAVY",
    tier: 3,
    priceStars: 3000,
    unlockLevel: 30,
    granted: false,
    stats: { strength: 22, agility: 10, stamina: 18, endurance: 18, balance: 14, technique: 14 },
    trait: "파워 집중",
  },
  {
    id: "ViO35_7A_CJR",
    label: "ViO35-7A-CJR",
    chassisClass: "HEAVY",
    tier: 3,
    priceStars: 3000,
    unlockLevel: 30,
    granted: false,
    stats: { strength: 20, agility: 14, stamina: 17, endurance: 17, balance: 14, technique: 14 },
    trait: "대형+기동",
  },
  {
    id: "ViO55_6A",
    label: "ViO55-6A",
    chassisClass: "HEAVY",
    tier: 3,
    priceStars: 3000,
    unlockLevel: 30,
    granted: false,
    stats: { strength: 24, agility: 9, stamina: 18, endurance: 18, balance: 15, technique: 12 },
    trait: "최대 적재형",
  },
  {
    id: "ViO80_7",
    label: "ViO80-7",
    chassisClass: "HEAVY",
    tier: 3,
    priceStars: 3000,
    unlockLevel: 30,
    granted: false,
    stats: { strength: 20, agility: 9, stamina: 20, endurance: 22, balance: 13, technique: 12 },
    trait: "내구·인내",
  },
  {
    id: "SV100_7",
    label: "SV100-7",
    chassisClass: "HEAVY",
    tier: 3,
    priceStars: 3000,
    unlockLevel: 30,
    granted: false,
    stats: { strength: 26, agility: 8, stamina: 20, endurance: 20, balance: 12, technique: 10 },
    trait: "초중량 힘",
  },
] as const;

export const DEFAULT_CHASSIS_ID: ChassisModelId = "ViO17_1";

export function getChassisDef(id: ChassisModelId | string): ChassisDef {
  const found = CHASSIS_CATALOG.find((c) => c.id === id);
  return found ?? CHASSIS_CATALOG.find((c) => c.id === DEFAULT_CHASSIS_ID)!;
}

export function isChassisUnlockedForPurchase(
  def: ChassisDef,
  playerLevel: number,
): boolean {
  if (def.granted) return false;
  return playerLevel >= def.unlockLevel;
}

export function parseOwnedChassisIds(raw: unknown): ChassisModelId[] {
  const ids = new Set<ChassisModelId>([DEFAULT_CHASSIS_ID]);
  const arr = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return [];
          }
        })()
      : [];
  if (Array.isArray(arr)) {
    for (const item of arr) {
      if (typeof item === "string" && CHASSIS_CATALOG.some((c) => c.id === item)) {
        ids.add(item as ChassisModelId);
      }
    }
  }
  return [...ids];
}
