/** Chassis consumable (fluid/filter) maintenance for Yanmar. */

export const MAINTENANCE_FLUID_IDS = [
  "engineOil",
  "engineOilFilter",
  "hydraulicOil",
  "hydraulicFilter",
  "fuelFilter",
  "gearOil",
] as const;

export type MaintenanceFluidId = (typeof MAINTENANCE_FLUID_IDS)[number];

export type MaintenanceWearKind = "distance" | "calendar";
export type MaintenanceLabelCategory = "oil" | "filter";
export type MaintenanceRepairKind = "free" | "premium" | "top";

export const MAINTENANCE_WARN_RATIO = 0.3;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const FREE_REPAIR_COOLDOWN_MS = 4 * 60 * 60 * 1000;
export const PREMIUM_REPAIR_COST = 20;
export const TOP_REPAIR_COST = 50;
export const PREMIUM_REPAIR_BUFF_MS = 12 * 60 * 60 * 1000;
export const TOP_REPAIR_BUFF_MS = 24 * 60 * 60 * 1000;
export const PREMIUM_CAPACITY_MULT = 2;
export const TOP_CAPACITY_MULT = 3;

export const OIL_REPAIR_LABELS = {
  free: "무료유",
  premium: "고급유",
  top: "최상급유",
} as const;

export const FILTER_REPAIR_LABELS = {
  free: "무료필터",
  premium: "고급필터",
  top: "최고급필터",
} as const;

export type FluidPenalty = {
  scoreMult?: number;
  workSpeedMult?: number;
  travelSpeedMult?: number;
  workXpMult?: number;
  criticalChanceMult?: number;
  criticalMultiplierMult?: number;
  bladeEfficiencyMult?: number;
  breakerDamageMult?: number;
};

export type MaintenanceFluidDef = {
  id: MaintenanceFluidId;
  label: string;
  wear: MaintenanceWearKind;
  /** Meters for one full 1× cycle (distance fluids). */
  cycleMeters?: number;
  /** Calendar days for one full 1× cycle (calendar fluids). */
  cycleDays?: number;
  labelCategory: MaintenanceLabelCategory;
  zeroPenalty: FluidPenalty;
};

export const MAINTENANCE_FLUIDS: Record<MaintenanceFluidId, MaintenanceFluidDef> =
  {
    engineOil: {
      id: "engineOil",
      label: "엔진오일",
      wear: "distance",
      cycleMeters: 100_000,
      labelCategory: "oil",
      zeroPenalty: {
        scoreMult: 0.85,
        workSpeedMult: 0.9,
        travelSpeedMult: 0.92,
      },
    },
    engineOilFilter: {
      id: "engineOilFilter",
      label: "엔진오일필터",
      wear: "distance",
      cycleMeters: 200_000,
      labelCategory: "filter",
      zeroPenalty: {
        workXpMult: 0.85,
        criticalChanceMult: 0.8,
      },
    },
    hydraulicOil: {
      id: "hydraulicOil",
      label: "유압유",
      wear: "calendar",
      cycleDays: 7,
      labelCategory: "oil",
      zeroPenalty: {
        scoreMult: 0.8,
        workSpeedMult: 0.85,
        breakerDamageMult: 0.85,
      },
    },
    hydraulicFilter: {
      id: "hydraulicFilter",
      label: "유압필터",
      wear: "calendar",
      cycleDays: 7,
      labelCategory: "filter",
      zeroPenalty: {
        workXpMult: 0.8,
        criticalMultiplierMult: 0.85,
      },
    },
    fuelFilter: {
      id: "fuelFilter",
      label: "연료필터",
      wear: "calendar",
      cycleDays: 14,
      labelCategory: "filter",
      zeroPenalty: {
        scoreMult: 0.9,
        workXpMult: 0.9,
        travelSpeedMult: 0.88,
      },
    },
    gearOil: {
      id: "gearOil",
      label: "기어오일",
      wear: "calendar",
      cycleDays: 14,
      labelCategory: "oil",
      zeroPenalty: {
        travelSpeedMult: 0.82,
        criticalChanceMult: 0.85,
        bladeEfficiencyMult: 0.9,
      },
    },
  };

export function isMaintenanceFluidId(value: string): value is MaintenanceFluidId {
  return (MAINTENANCE_FLUID_IDS as readonly string[]).includes(value);
}

export function getRepairLabels(fluidId: MaintenanceFluidId) {
  const cat = MAINTENANCE_FLUIDS[fluidId].labelCategory;
  return cat === "filter" ? FILTER_REPAIR_LABELS : OIL_REPAIR_LABELS;
}

export function repairCost(kind: MaintenanceRepairKind): number {
  if (kind === "premium") return PREMIUM_REPAIR_COST;
  if (kind === "top") return TOP_REPAIR_COST;
  return 0;
}

export function repairCapacityMult(kind: MaintenanceRepairKind): number {
  if (kind === "premium") return PREMIUM_CAPACITY_MULT;
  if (kind === "top") return TOP_CAPACITY_MULT;
  return 1;
}

export function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function calendarRemainingRatio(
  filledAt: Date | string | null | undefined,
  capacityMult: number,
  cycleDays: number,
  nowMs = Date.now(),
): number {
  const mult = Math.max(1, capacityMult || 1);
  const capacityMs = cycleDays * mult * DAY_MS;
  if (!filledAt) return 1;
  const filledMs =
    typeof filledAt === "string"
      ? new Date(filledAt).getTime()
      : filledAt.getTime();
  if (!Number.isFinite(filledMs)) return 1;
  const elapsed = Math.max(0, nowMs - filledMs);
  return clampRatio(1 - elapsed / capacityMs);
}

export type FluidSnapshot = {
  id: MaintenanceFluidId;
  label: string;
  remaining: number;
  percent: number;
  capacityMult: number;
  wear: MaintenanceWearKind;
  freeAvailableAt: string | null;
  /** Remaining meters until empty (distance) or null. */
  remainingMeters: number | null;
  /** Remaining days until empty (calendar) or null. */
  remainingDays: number | null;
  depleted: boolean;
  warning: boolean;
};

export type MaintenanceSnapshot = {
  odometerMeters: number;
  fluids: Record<MaintenanceFluidId, FluidSnapshot>;
  warnings: FluidSnapshot[];
};

/** Raw row fields from UserRepairState (partial-friendly). */
export type RepairStateRow = {
  odometerMeters?: number | null;
  engineOilRemaining?: number | null;
  engineOilCapacityMult?: number | null;
  engineOilFreeAvailableAt?: Date | string | null;
  engineOilFilterRemaining?: number | null;
  engineOilFilterCapacityMult?: number | null;
  engineOilFilterFreeAvailableAt?: Date | string | null;
  hydraulicOilFilledAt?: Date | string | null;
  hydraulicOilCapacityMult?: number | null;
  hydraulicOilFreeAvailableAt?: Date | string | null;
  hydraulicFilterFilledAt?: Date | string | null;
  hydraulicFilterCapacityMult?: number | null;
  hydraulicFilterFreeAvailableAt?: Date | string | null;
  fuelFilterFilledAt?: Date | string | null;
  fuelFilterCapacityMult?: number | null;
  fuelFilterFreeAvailableAt?: Date | string | null;
  gearOilFilledAt?: Date | string | null;
  gearOilCapacityMult?: number | null;
  gearOilFreeAvailableAt?: Date | string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}

function buildFluidSnapshot(
  def: MaintenanceFluidDef,
  remaining: number,
  capacityMult: number,
  freeAvailableAt: Date | string | null | undefined,
): FluidSnapshot {
  const rem = clampRatio(remaining);
  const mult = Math.max(1, capacityMult || 1);
  let remainingMeters: number | null = null;
  let remainingDays: number | null = null;
  if (def.wear === "distance" && def.cycleMeters) {
    remainingMeters = rem * def.cycleMeters * mult;
  }
  if (def.wear === "calendar" && def.cycleDays) {
    remainingDays = rem * def.cycleDays * mult;
  }
  return {
    id: def.id,
    label: def.label,
    remaining: rem,
    percent: Math.round(rem * 100),
    capacityMult: mult,
    wear: def.wear,
    freeAvailableAt: toIso(freeAvailableAt),
    remainingMeters,
    remainingDays,
    depleted: rem <= 0,
    warning: rem > 0 && rem <= MAINTENANCE_WARN_RATIO,
  };
}

export function computeMaintenanceSnapshot(
  row: RepairStateRow | null | undefined,
  nowMs = Date.now(),
): MaintenanceSnapshot {
  const odometerMeters = Math.max(0, Number(row?.odometerMeters) || 0);

  const engineOil = buildFluidSnapshot(
    MAINTENANCE_FLUIDS.engineOil,
    Number(row?.engineOilRemaining ?? 1),
    Number(row?.engineOilCapacityMult ?? 1),
    row?.engineOilFreeAvailableAt,
  );
  const engineOilFilter = buildFluidSnapshot(
    MAINTENANCE_FLUIDS.engineOilFilter,
    Number(row?.engineOilFilterRemaining ?? 1),
    Number(row?.engineOilFilterCapacityMult ?? 1),
    row?.engineOilFilterFreeAvailableAt,
  );

  const hydraulicOilRem = calendarRemainingRatio(
    row?.hydraulicOilFilledAt,
    Number(row?.hydraulicOilCapacityMult ?? 1),
    MAINTENANCE_FLUIDS.hydraulicOil.cycleDays!,
    nowMs,
  );
  const hydraulicOil = buildFluidSnapshot(
    MAINTENANCE_FLUIDS.hydraulicOil,
    hydraulicOilRem,
    Number(row?.hydraulicOilCapacityMult ?? 1),
    row?.hydraulicOilFreeAvailableAt,
  );

  const hydraulicFilterRem = calendarRemainingRatio(
    row?.hydraulicFilterFilledAt,
    Number(row?.hydraulicFilterCapacityMult ?? 1),
    MAINTENANCE_FLUIDS.hydraulicFilter.cycleDays!,
    nowMs,
  );
  const hydraulicFilter = buildFluidSnapshot(
    MAINTENANCE_FLUIDS.hydraulicFilter,
    hydraulicFilterRem,
    Number(row?.hydraulicFilterCapacityMult ?? 1),
    row?.hydraulicFilterFreeAvailableAt,
  );

  const fuelFilterRem = calendarRemainingRatio(
    row?.fuelFilterFilledAt,
    Number(row?.fuelFilterCapacityMult ?? 1),
    MAINTENANCE_FLUIDS.fuelFilter.cycleDays!,
    nowMs,
  );
  const fuelFilter = buildFluidSnapshot(
    MAINTENANCE_FLUIDS.fuelFilter,
    fuelFilterRem,
    Number(row?.fuelFilterCapacityMult ?? 1),
    row?.fuelFilterFreeAvailableAt,
  );

  const gearOilRem = calendarRemainingRatio(
    row?.gearOilFilledAt,
    Number(row?.gearOilCapacityMult ?? 1),
    MAINTENANCE_FLUIDS.gearOil.cycleDays!,
    nowMs,
  );
  const gearOil = buildFluidSnapshot(
    MAINTENANCE_FLUIDS.gearOil,
    gearOilRem,
    Number(row?.gearOilCapacityMult ?? 1),
    row?.gearOilFreeAvailableAt,
  );

  const fluids: Record<MaintenanceFluidId, FluidSnapshot> = {
    engineOil,
    engineOilFilter,
    hydraulicOil,
    hydraulicFilter,
    fuelFilter,
    gearOil,
  };

  const warnings = MAINTENANCE_FLUID_IDS.map((id) => fluids[id])
    .filter((f) => f.warning || f.depleted)
    .sort((a, b) => a.remaining - b.remaining)
    .slice(0, 3);

  return { odometerMeters, fluids, warnings };
}

export function accumulateZeroPenalties(
  fluids: Record<MaintenanceFluidId, FluidSnapshot>,
): Required<FluidPenalty> {
  const acc: Required<FluidPenalty> = {
    scoreMult: 1,
    workSpeedMult: 1,
    travelSpeedMult: 1,
    workXpMult: 1,
    criticalChanceMult: 1,
    criticalMultiplierMult: 1,
    bladeEfficiencyMult: 1,
    breakerDamageMult: 1,
  };
  for (const id of MAINTENANCE_FLUID_IDS) {
    if (!fluids[id].depleted) continue;
    const p = MAINTENANCE_FLUIDS[id].zeroPenalty;
    if (p.scoreMult) acc.scoreMult *= p.scoreMult;
    if (p.workSpeedMult) acc.workSpeedMult *= p.workSpeedMult;
    if (p.travelSpeedMult) acc.travelSpeedMult *= p.travelSpeedMult;
    if (p.workXpMult) acc.workXpMult *= p.workXpMult;
    if (p.criticalChanceMult) acc.criticalChanceMult *= p.criticalChanceMult;
    if (p.criticalMultiplierMult) {
      acc.criticalMultiplierMult *= p.criticalMultiplierMult;
    }
    if (p.bladeEfficiencyMult) acc.bladeEfficiencyMult *= p.bladeEfficiencyMult;
    if (p.breakerDamageMult) acc.breakerDamageMult *= p.breakerDamageMult;
  }
  return acc;
}

/** Apply travel meters to distance fluids; returns update payload for Prisma. */
export function applyTravelMeters(
  row: RepairStateRow,
  travelMeters: number,
): {
  odometerMeters: number;
  engineOilRemaining: number;
  engineOilFilterRemaining: number;
} {
  const meters = Math.max(0, travelMeters);
  const odometerMeters = Math.max(0, Number(row.odometerMeters) || 0) + meters;
  const oilMult = Math.max(1, Number(row.engineOilCapacityMult) || 1);
  const filterMult = Math.max(1, Number(row.engineOilFilterCapacityMult) || 1);
  const oilCycle = MAINTENANCE_FLUIDS.engineOil.cycleMeters! * oilMult;
  const filterCycle =
    MAINTENANCE_FLUIDS.engineOilFilter.cycleMeters! * filterMult;
  const engineOilRemaining = clampRatio(
    (Number(row.engineOilRemaining) || 0) - meters / oilCycle,
  );
  const engineOilFilterRemaining = clampRatio(
    (Number(row.engineOilFilterRemaining) || 0) - meters / filterCycle,
  );
  return {
    odometerMeters,
    engineOilRemaining,
    engineOilFilterRemaining,
  };
}

export function fluidFreeAvailableAtField(
  fluidId: MaintenanceFluidId,
):
  | "engineOilFreeAvailableAt"
  | "engineOilFilterFreeAvailableAt"
  | "hydraulicOilFreeAvailableAt"
  | "hydraulicFilterFreeAvailableAt"
  | "fuelFilterFreeAvailableAt"
  | "gearOilFreeAvailableAt" {
  switch (fluidId) {
    case "engineOil":
      return "engineOilFreeAvailableAt";
    case "engineOilFilter":
      return "engineOilFilterFreeAvailableAt";
    case "hydraulicOil":
      return "hydraulicOilFreeAvailableAt";
    case "hydraulicFilter":
      return "hydraulicFilterFreeAvailableAt";
    case "fuelFilter":
      return "fuelFilterFreeAvailableAt";
    case "gearOil":
      return "gearOilFreeAvailableAt";
  }
}

export function buildServiceUpdate(
  fluidId: MaintenanceFluidId,
  kind: MaintenanceRepairKind,
  now = new Date(),
): Record<string, number | Date | null> {
  const mult = repairCapacityMult(kind);
  const freeField = fluidFreeAvailableAtField(fluidId);
  const data: Record<string, number | Date | null> = {};

  if (fluidId === "engineOil") {
    data.engineOilRemaining = 1;
    data.engineOilCapacityMult = mult;
  } else if (fluidId === "engineOilFilter") {
    data.engineOilFilterRemaining = 1;
    data.engineOilFilterCapacityMult = mult;
  } else if (fluidId === "hydraulicOil") {
    data.hydraulicOilFilledAt = now;
    data.hydraulicOilCapacityMult = mult;
  } else if (fluidId === "hydraulicFilter") {
    data.hydraulicFilterFilledAt = now;
    data.hydraulicFilterCapacityMult = mult;
  } else if (fluidId === "fuelFilter") {
    data.fuelFilterFilledAt = now;
    data.fuelFilterCapacityMult = mult;
  } else {
    data.gearOilFilledAt = now;
    data.gearOilCapacityMult = mult;
  }

  if (kind === "free") {
    data[freeField] = new Date(now.getTime() + FREE_REPAIR_COOLDOWN_MS);
  }

  return data;
}

export function getFluidFreeAvailableAt(
  row: RepairStateRow,
  fluidId: MaintenanceFluidId,
): Date | string | null | undefined {
  return row[fluidFreeAvailableAtField(fluidId)];
}

/** Ensure calendar fluids have filledAt so remaining starts full for new rows. */
export function calendarFillDefaults(now = new Date()) {
  return {
    hydraulicOilFilledAt: now,
    hydraulicFilterFilledAt: now,
    fuelFilterFilledAt: now,
    gearOilFilledAt: now,
  };
}
