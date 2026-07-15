import {
  DEFAULT_CHASSIS_ID,
  getChassisDef,
  type ChassisBaseStats,
  type ChassisModelId,
} from "./chassisCatalog";
import {
  MAIN_OPTION_BY_SLOT,
  MAIN_OPTION_KEYS,
  isMainOptionKey,
  type GearSlot,
  type MainOptionKey,
  type MasterOptionKey,
} from "./gearCatalog";
import type { GearItemData, MasterOptionInst } from "./gearGenerate";
import { resolveMaxMasterByKey } from "./gearGenerate";
import {
  YANMAR_BASE_HAUL_TRUCK_CAPACITY,
  YANMAR_BASE_HAUL_TRUCK_COOLDOWN_SEC,
  YANMAR_BASE_HILL_BOULDER_COUNT,
  YANMAR_BASE_HILL_SAFE_LOAD_CHANCE,
  YANMAR_REWARD_CONFIG,
  type YanmarEquipmentStats,
} from "./equipment";
import {
  accumulateZeroPenalties,
  computeMaintenanceSnapshot,
  type MaintenanceSnapshot,
  type RepairStateRow,
} from "./maintenance";

export type RepairBuffKind = "NONE" | "SMALL" | "LARGE";

export interface FinalYanmarStats extends YanmarEquipmentStats {
  workSpeedMultiplier: number;
  bladeEfficiency: number;
  reachMultiplier: number;
  durabilityMaxPerPiece: number;
  durabilityDrainMult: number;
  /** Work-only XP bonus (excludes mission). Currently unused by ability subs. */
  workExpGainBonus: number;
  /** Multiplier applied to earned scores (maintenance 0% penalties). */
  scoreMult: number;
  /** Multiplier applied to work XP after sub-option bonus. */
  workXpMult: number;
  chassisId: ChassisModelId;
  /** 차체 + 장착 주옵션(+정비버프)이 반영된 최종 6능력치 */
  chassisStats: ChassisBaseStats;
  activeMasters: Partial<Record<MasterOptionKey, MasterOptionInst>>;
  repairBuff: RepairBuffKind;
  maintenance: MaintenanceSnapshot;
}

export interface EquippedGearInput {
  slot: GearSlot;
  durability: number;
  data: Pick<
    GearItemData,
    "slot" | "grade" | "enhanceLevel" | "mainOption" | "subOptions" | "masterOption"
  >;
}

function deriveFromChassis(stats: ChassisBaseStats) {
  const travelSpeedMultiplier = Math.min(1.4, 0.85 + stats.agility * 0.015);
  const workSpeedMultiplier = 0.9 + stats.agility * 0.01;
  const maxLoadUnits = 800 + stats.strength * 40;
  const breakerDamage = Math.floor(stats.strength * 0.35);
  const gripAdhesionBonus = stats.balance * 0.004;
  const hillSafeLoadBonus = stats.balance * 0.003;
  const durabilityMaxPerPiece = 40 + stats.stamina * 6;
  const durabilityDrainMult = Math.max(0.5, 1.2 - stats.endurance * 0.02);
  const baseCritChance = 0.03 + stats.technique * 0.002;
  return {
    travelSpeedMultiplier,
    workSpeedMultiplier,
    maxLoadUnits,
    breakerDamage,
    gripAdhesionBonus,
    hillSafeLoadChance: Math.min(
      1,
      YANMAR_BASE_HILL_SAFE_LOAD_CHANCE + hillSafeLoadBonus,
    ),
    durabilityMaxPerPiece,
    durabilityDrainMult,
    criticalChance: baseCritChance,
    criticalMultiplier: YANMAR_REWARD_CONFIG.baseCriticalMultiplier,
  };
}

function addMainStat(
  stats: ChassisBaseStats,
  key: MainOptionKey,
  value: number,
): ChassisBaseStats {
  return { ...stats, [key]: stats[key] + value };
}

function emptyAbilityMap(): Record<MainOptionKey, number> {
  return {
    strength: 0,
    agility: 0,
    stamina: 0,
    endurance: 0,
    balance: 0,
    technique: 0,
  };
}

export function calculateFinalYanmarStats(input: {
  chassisId?: ChassisModelId | string;
  equipped?: EquippedGearInput[];
  repairBuff?: RepairBuffKind;
  repairState?: RepairStateRow | null;
  nowMs?: number;
}): FinalYanmarStats {
  const chassis = getChassisDef(input.chassisId ?? DEFAULT_CHASSIS_ID);
  let stats = { ...chassis.stats };
  const repairBuff = input.repairBuff ?? "NONE";
  if (repairBuff === "SMALL") {
    stats = {
      ...stats,
      agility: Math.round(stats.agility * 1.05),
    };
  } else if (repairBuff === "LARGE") {
    stats = {
      ...stats,
      strength: Math.round(stats.strength * 1.08),
      endurance: Math.round(stats.endurance * 1.08),
    };
  }

  const equipped = input.equipped ?? [];
  const maintenance = computeMaintenanceSnapshot(
    input.repairState,
    input.nowMs ?? Date.now(),
  );
  const penalties = accumulateZeroPenalties(maintenance.fluids);

  // 주옵션: 부위별 고정 능력치에 flat 가산
  for (const g of equipped) {
    const slotKey = MAIN_OPTION_BY_SLOT[g.slot].key;
    const main = g.data.mainOption;
    const key =
      main.key && isMainOptionKey(main.key) ? main.key : slotKey;
    const value = typeof main.value === "number" ? main.value : 0;
    if (value > 0) {
      stats = addMainStat(stats, key, value);
    }
  }

  // 부옵션: flat(+N) 합산 후 percent(+N%) 배수 적용 → 파생값 계산
  const flatBonus = emptyAbilityMap();
  const percentBonus = emptyAbilityMap();
  for (const g of equipped) {
    for (const sub of g.data.subOptions) {
      if (!isMainOptionKey(sub.key)) continue;
      const value = typeof sub.value === "number" ? sub.value : 0;
      if (value <= 0) continue;
      if (sub.isPercent) {
        percentBonus[sub.key] += value;
      } else {
        flatBonus[sub.key] += value;
      }
    }
  }
  for (const key of MAIN_OPTION_KEYS) {
    const withFlat = stats[key] + flatBonus[key];
    stats = {
      ...stats,
      [key]: withFlat * (1 + percentBonus[key] / 100),
    };
  }

  const base = deriveFromChassis(stats);

  let maxLoadUnits = base.maxLoadUnits;
  let criticalChance = base.criticalChance;
  let criticalMultiplier = base.criticalMultiplier;
  let travelSpeedMultiplier = base.travelSpeedMultiplier;
  let workSpeedMultiplier = base.workSpeedMultiplier;
  let breakerDamage = base.breakerDamage;
  let gripAdhesionBonus = base.gripAdhesionBonus;
  let hillSafeLoadChance = base.hillSafeLoadChance;
  let bladeEfficiency = 1;
  let durabilityDrainMult = base.durabilityDrainMult;
  const reachMultiplier = 1;

  travelSpeedMultiplier *= penalties.travelSpeedMult;
  workSpeedMultiplier *= penalties.workSpeedMult;
  criticalChance *= penalties.criticalChanceMult;
  criticalMultiplier *= penalties.criticalMultiplierMult;
  bladeEfficiency *= penalties.bladeEfficiencyMult;
  breakerDamage *= penalties.breakerDamageMult;

  const masters = resolveMaxMasterByKey(
    equipped.map((g) => g.data.masterOption),
  );
  const activeMasters: Partial<Record<MasterOptionKey, MasterOptionInst>> = {};
  for (const [k, v] of masters) activeMasters[k] = v;
  const breakerEvery3 = activeMasters.breakerEvery3HitMult?.value ?? 1;

  return {
    maxLoadUnits: Math.round(maxLoadUnits),
    truckCapacityUnits: YANMAR_REWARD_CONFIG.baseTruckCapacityUnits,
    truckCooldownSec: YANMAR_REWARD_CONFIG.baseTruckCooldownSec,
    scoreChunkUnits: YANMAR_REWARD_CONFIG.scoreChunkUnits,
    criticalChance: Math.min(0.75, criticalChance),
    criticalMultiplier,
    scoreMult: penalties.scoreMult,
    workXpMult: penalties.workXpMult,
    travelSpeedMultiplier,
    workSpeedMultiplier,
    breakerDamage: Math.max(0, Math.round(breakerDamage)),
    crashRespawnSec: 5 * 60,
    haulTruckCooldownSec: YANMAR_BASE_HAUL_TRUCK_COOLDOWN_SEC,
    haulTruckCapacity: YANMAR_BASE_HAUL_TRUCK_CAPACITY,
    hillBoulderCount: YANMAR_BASE_HILL_BOULDER_COUNT,
    gripAdhesionBonus,
    hillSafeLoadChance,
    breakerEvery3HitMult: breakerEvery3,
    bladeEfficiency,
    reachMultiplier,
    durabilityMaxPerPiece: base.durabilityMaxPerPiece,
    durabilityDrainMult,
    workExpGainBonus: 0,
    chassisId: chassis.id,
    chassisStats: {
      strength: Math.round(stats.strength),
      agility: Math.round(stats.agility),
      stamina: Math.round(stats.stamina),
      endurance: Math.round(stats.endurance),
      balance: Math.round(stats.balance),
      technique: Math.round(stats.technique),
    },
    activeMasters,
    repairBuff,
    maintenance,
  };
}

export function defaultFinalStats(): FinalYanmarStats {
  return calculateFinalYanmarStats({
    chassisId: DEFAULT_CHASSIS_ID,
    equipped: [],
  });
}
