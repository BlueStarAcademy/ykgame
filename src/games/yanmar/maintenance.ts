/** Chassis consumable (fluid/filter) maintenance — time cycles + claim rewards. */

export const MAINTENANCE_FLUID_IDS = [
  "engineOil",
  "engineOilFilter",
  "hydraulicOil",
  "hydraulicFilter",
  "fuelFilter",
  "gearOil",
] as const;

export type MaintenanceFluidId = (typeof MAINTENANCE_FLUID_IDS)[number];

export type MaintenanceLabelCategory = "oil" | "filter";
export type MaintenancePointKind = "dump" | "crash" | "hill" | "monument";
export type MaintenanceClaimBuffKind = "SMALL" | "LARGE";

export const MAINTENANCE_WARN_RATIO = 0.3;
export const HOUR_MS = 60 * 60 * 1000;
/** @deprecated Prefer HOUR_MS; kept for callers that imported DAY_MS. */
export const DAY_MS = 24 * HOUR_MS;

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
  /** Real-time hours for one full cycle. */
  cycleHours: number;
  labelCategory: MaintenanceLabelCategory;
  pointKind: MaintenancePointKind;
  /** One-line what this part is. */
  blurb: string;
  /** One-line why it must be replaced. */
  whyReplace: string;
  zeroPenalty: FluidPenalty;
};

export const MAINTENANCE_FLUID_ART: Record<MaintenanceFluidId, string> = {
  engineOil: "/images/yanmar/2d/repair/engine-oil.png?v=1",
  engineOilFilter: "/images/yanmar/2d/repair/engine-oil-filter.png?v=1",
  hydraulicOil: "/images/yanmar/2d/repair/hydraulic-oil.png?v=1",
  hydraulicFilter: "/images/yanmar/2d/repair/hydraulic-filter.png?v=1",
  fuelFilter: "/images/yanmar/2d/repair/fuel-filter.png?v=1",
  gearOil: "/images/yanmar/2d/repair/gear-oil.png?v=1",
};

export const MAINTENANCE_FLUIDS: Record<MaintenanceFluidId, MaintenanceFluidDef> =
  {
    engineOil: {
      id: "engineOil",
      label: "엔진오일",
      cycleHours: 4,
      labelCategory: "oil",
      pointKind: "dump",
      blurb: "엔진 마찰을 줄이고 열을 식혀 주는 윤활유입니다.",
      whyReplace:
        "오래되면 점도가 무너져 출력·연비가 떨어지고 과열 위험이 커집니다.",
      zeroPenalty: {
        scoreMult: 0.85,
        workSpeedMult: 0.9,
        travelSpeedMult: 0.92,
      },
    },
    engineOilFilter: {
      id: "engineOilFilter",
      label: "엔진오일필터",
      cycleHours: 8,
      labelCategory: "filter",
      pointKind: "crash",
      blurb: "엔진오일 속 금속분·불순물을 걸러 주는 필터입니다.",
      whyReplace:
        "막히면 오일 순환이 나빠져 엔진 마모와 응답 저하가 빨라집니다.",
      zeroPenalty: {
        workXpMult: 0.85,
        criticalChanceMult: 0.8,
      },
    },
    hydraulicOil: {
      id: "hydraulicOil",
      label: "유압유",
      cycleHours: 12,
      labelCategory: "oil",
      pointKind: "crash",
      blurb: "붐·암·버켓을 움직이는 유압 장치의 작동유입니다.",
      whyReplace:
        "열화되면 압력 손실이 나 작업 속도·브레이커 힘이 약해집니다.",
      zeroPenalty: {
        scoreMult: 0.8,
        workSpeedMult: 0.85,
        breakerDamageMult: 0.85,
      },
    },
    hydraulicFilter: {
      id: "hydraulicFilter",
      label: "유압필터",
      cycleHours: 24,
      labelCategory: "filter",
      pointKind: "hill",
      blurb: "유압유 속 이물질을 막아 밸브·펌프를 보호합니다.",
      whyReplace:
        "막히면 유압 회로가 불안정해지고 정밀 조작·출력이 흔들립니다.",
      zeroPenalty: {
        workXpMult: 0.8,
        criticalMultiplierMult: 0.85,
      },
    },
    fuelFilter: {
      id: "fuelFilter",
      label: "연료필터",
      cycleHours: 72,
      labelCategory: "filter",
      pointKind: "dump",
      blurb: "연료 속 수분·찌꺼기를 걸러 엔진에 깨끗한 연료를 보냅니다.",
      whyReplace:
        "막히면 연료 공급이 들쭉날쭉해 주행·작업 응답이 둔해집니다.",
      zeroPenalty: {
        scoreMult: 0.9,
        workXpMult: 0.9,
        travelSpeedMult: 0.88,
      },
    },
    gearOil: {
      id: "gearOil",
      label: "기어오일",
      cycleHours: 168,
      labelCategory: "oil",
      pointKind: "monument",
      blurb: "주행·선회 기어박스의 마찰과 충격으로 받는 힘을 막아 줍니다.",
      whyReplace:
        "부족·열화 시 기어 마모가 커져 주행·선회가 무겁고 소음이 납니다.",
      zeroPenalty: {
        travelSpeedMult: 0.82,
        criticalChanceMult: 0.85,
        bladeEfficiencyMult: 0.9,
      },
    },
  };

/** Guaranteed claim payout (XP is garnish only). */
export type MaintenanceReward = {
  stars: number;
  enhanceCores?: number;
  gachaTicketsStandard?: number;
  gachaTicketsPremium?: number;
  workshopPoints: number;
  xpGarnish: number;
};

export const MAINTENANCE_REWARDS: Record<MaintenanceFluidId, MaintenanceReward> =
  {
    engineOil: {
      stars: 12,
      workshopPoints: 40,
      xpGarnish: 50,
    },
    engineOilFilter: {
      stars: 12,
      workshopPoints: 50,
      xpGarnish: 50,
    },
    hydraulicOil: {
      stars: 16,
      workshopPoints: 80,
      xpGarnish: 50,
    },
    hydraulicFilter: {
      stars: 15,
      enhanceCores: 1,
      workshopPoints: 60,
      xpGarnish: 80,
    },
    fuelFilter: {
      stars: 30,
      gachaTicketsStandard: 1,
      workshopPoints: 100,
      xpGarnish: 100,
    },
    gearOil: {
      stars: 55,
      enhanceCores: 2,
      workshopPoints: 150,
      xpGarnish: 150,
    },
  };

export type MaintenanceClaimBuff = {
  kind: MaintenanceClaimBuffKind;
  durationMs: number;
  label: string;
};

export const MAINTENANCE_CLAIM_BUFF: Record<
  MaintenanceFluidId,
  MaintenanceClaimBuff
> = {
  engineOil: {
    kind: "SMALL",
    durationMs: 45 * 60 * 1000,
    label: "민첩 +5% · 45분",
  },
  engineOilFilter: {
    kind: "SMALL",
    durationMs: 60 * 60 * 1000,
    label: "민첩 +5% · 1시간",
  },
  hydraulicOil: {
    kind: "SMALL",
    durationMs: 90 * 60 * 1000,
    label: "민첩 +5% · 1시간 30분",
  },
  hydraulicFilter: {
    kind: "LARGE",
    durationMs: 2 * 60 * 60 * 1000,
    label: "힘·인내 +8% · 2시간",
  },
  fuelFilter: {
    kind: "LARGE",
    durationMs: 4 * 60 * 60 * 1000,
    label: "힘·인내 +8% · 4시간",
  },
  gearOil: {
    kind: "LARGE",
    durationMs: 8 * 60 * 60 * 1000,
    label: "힘·인내 +8% · 8시간",
  },
};

export type MaintenanceBonusOutcome = {
  stars?: number;
  enhanceCores?: number;
  gachaTicketsStandard?: number;
  gachaTicketsPremium?: number;
  workshopPoints?: number;
  label: string;
};

type BonusEntry = { weight: number; outcome: MaintenanceBonusOutcome };

const SHORT_BONUS_TABLE: readonly BonusEntry[] = [
  { weight: 35, outcome: { stars: 8, label: "추가 스타 +8" } },
  { weight: 25, outcome: { workshopPoints: 30, label: "포인트 +30" } },
  { weight: 18, outcome: { enhanceCores: 1, label: "강화코어 +1" } },
  {
    weight: 12,
    outcome: { gachaTicketsStandard: 1, label: "일반 뽑기권 +1" },
  },
  { weight: 5, outcome: { stars: 3, label: "추가 스타 +3" } },
  {
    weight: 5,
    outcome: { gachaTicketsPremium: 1, label: "고급 뽑기권 +1" },
  },
];

const DAILY_BONUS_TABLE: readonly BonusEntry[] = [
  { weight: 30, outcome: { stars: 15, label: "추가 스타 +15" } },
  { weight: 25, outcome: { enhanceCores: 1, label: "강화코어 +1" } },
  { weight: 20, outcome: { workshopPoints: 50, label: "포인트 +50" } },
  {
    weight: 15,
    outcome: { gachaTicketsStandard: 1, label: "일반 뽑기권 +1" },
  },
  { weight: 5, outcome: { enhanceCores: 2, label: "강화코어 +2" } },
  {
    weight: 5,
    outcome: { gachaTicketsPremium: 1, label: "고급 뽑기권 +1" },
  },
];

const FUEL_BONUS_TABLE: readonly BonusEntry[] = [
  { weight: 25, outcome: { stars: 25, label: "추가 스타 +25" } },
  { weight: 20, outcome: { enhanceCores: 2, label: "강화코어 +2" } },
  { weight: 20, outcome: { workshopPoints: 80, label: "포인트 +80" } },
  {
    weight: 15,
    outcome: { gachaTicketsStandard: 1, label: "일반 뽑기권 +1" },
  },
  {
    weight: 15,
    outcome: { gachaTicketsPremium: 1, label: "고급 뽑기권 +1" },
  },
  {
    weight: 5,
    outcome: { gachaTicketsStandard: 2, label: "일반 뽑기권 +2" },
  },
];

const GEAR_BONUS_TABLE: readonly BonusEntry[] = [
  { weight: 25, outcome: { stars: 40, label: "추가 스타 +40" } },
  { weight: 20, outcome: { enhanceCores: 3, label: "강화코어 +3" } },
  { weight: 20, outcome: { workshopPoints: 120, label: "조형물 포인트 +120" } },
  {
    weight: 15,
    outcome: { gachaTicketsPremium: 1, label: "고급 뽑기권 +1" },
  },
  {
    weight: 10,
    outcome: { gachaTicketsPremium: 2, label: "고급 뽑기권 +2" },
  },
  {
    weight: 10,
    outcome: { gachaTicketsStandard: 2, label: "일반 뽑기권 +2" },
  },
];

export function bonusTableForFluid(
  fluidId: MaintenanceFluidId,
): readonly BonusEntry[] {
  const hours = MAINTENANCE_FLUIDS[fluidId].cycleHours;
  if (hours <= 12) return SHORT_BONUS_TABLE;
  if (hours <= 24) return DAILY_BONUS_TABLE;
  if (hours <= 72) return FUEL_BONUS_TABLE;
  return GEAR_BONUS_TABLE;
}

export function rollMaintenanceBonus(
  fluidId: MaintenanceFluidId,
  rng: () => number = Math.random,
): MaintenanceBonusOutcome {
  const table = bonusTableForFluid(fluidId);
  const total = table.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng() * total;
  for (const entry of table) {
    roll -= entry.weight;
    if (roll <= 0) return entry.outcome;
  }
  return table[table.length - 1]!.outcome;
}

export function pointKindLabel(kind: MaintenancePointKind): string {
  switch (kind) {
    case "dump":
      return "하역 포인트";
    case "crash":
      return "브레이커 포인트";
    case "hill":
      return "돌하역 포인트";
    case "monument":
      return "조형물 포인트";
  }
}

export function pointKindUserField(
  kind: MaintenancePointKind,
):
  | "dumpWorkshopPoints"
  | "crashWorkshopPoints"
  | "hillWorkshopPoints"
  | "monumentPoints" {
  switch (kind) {
    case "dump":
      return "dumpWorkshopPoints";
    case "crash":
      return "crashWorkshopPoints";
    case "hill":
      return "hillWorkshopPoints";
    case "monument":
      return "monumentPoints";
  }
}

export function isMaintenanceFluidId(value: string): value is MaintenanceFluidId {
  return (MAINTENANCE_FLUID_IDS as readonly string[]).includes(value);
}

export function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function calendarRemainingRatio(
  filledAt: Date | string | null | undefined,
  cycleHours: number,
  nowMs = Date.now(),
  capacityMult = 1,
): number {
  const mult = Math.max(1, capacityMult || 1);
  const capacityMs = Math.max(1, cycleHours) * mult * HOUR_MS;
  if (!filledAt) return 1;
  const filledMs =
    typeof filledAt === "string"
      ? new Date(filledAt).getTime()
      : filledAt.getTime();
  if (!Number.isFinite(filledMs)) return 1;
  const elapsed = Math.max(0, nowMs - filledMs);
  return clampRatio(1 - elapsed / capacityMs);
}

/** Exchange + rewards only when the timer has fully expired. */
export function isExchangeEligible(remaining: number): boolean {
  return remaining <= 0;
}

export function formatCycleHours(hours: number): string {
  return `교환 주기 ${hours}시간`;
}

export function formatRemainingDuration(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const totalMin = Math.floor(clamped / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간 ${mins}분`;
  return `${mins}분`;
}

/** Remaining time as H:MM:SS (hours may exceed 24). */
export function formatRemainingHhMm(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export type FluidSnapshot = {
  id: MaintenanceFluidId;
  label: string;
  remaining: number;
  percent: number;
  capacityMult: number;
  /** Always calendar/time. */
  wear: "calendar";
  freeAvailableAt: string | null;
  /** ISO timestamp when the current cycle started. */
  filledAt: string | null;
  remainingMeters: number | null;
  remainingDays: number | null;
  /** Remaining time until empty (ms). */
  remainingMs: number;
  cycleHours: number;
  depleted: boolean;
  warning: boolean;
  exchangeEligible: boolean;
};

export type MaintenanceSnapshot = {
  odometerMeters: number;
  fluids: Record<MaintenanceFluidId, FluidSnapshot>;
  warnings: FluidSnapshot[];
};

/** Raw row fields from UserRepairState (partial-friendly). */
export type RepairStateRow = {
  odometerMeters?: number | null;
  engineOilFilledAt?: Date | string | null;
  engineOilRemaining?: number | null;
  engineOilCapacityMult?: number | null;
  engineOilFreeAvailableAt?: Date | string | null;
  engineOilFilterFilledAt?: Date | string | null;
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

function filledAtForFluid(
  row: RepairStateRow | null | undefined,
  fluidId: MaintenanceFluidId,
): Date | string | null | undefined {
  switch (fluidId) {
    case "engineOil":
      return row?.engineOilFilledAt;
    case "engineOilFilter":
      return row?.engineOilFilterFilledAt;
    case "hydraulicOil":
      return row?.hydraulicOilFilledAt;
    case "hydraulicFilter":
      return row?.hydraulicFilterFilledAt;
    case "fuelFilter":
      return row?.fuelFilterFilledAt;
    case "gearOil":
      return row?.gearOilFilledAt;
  }
}

function capacityMultForFluid(
  row: RepairStateRow | null | undefined,
  fluidId: MaintenanceFluidId,
): number {
  switch (fluidId) {
    case "engineOil":
      return Number(row?.engineOilCapacityMult ?? 1);
    case "engineOilFilter":
      return Number(row?.engineOilFilterCapacityMult ?? 1);
    case "hydraulicOil":
      return Number(row?.hydraulicOilCapacityMult ?? 1);
    case "hydraulicFilter":
      return Number(row?.hydraulicFilterCapacityMult ?? 1);
    case "fuelFilter":
      return Number(row?.fuelFilterCapacityMult ?? 1);
    case "gearOil":
      return Number(row?.gearOilCapacityMult ?? 1);
  }
}

function freeAtForFluid(
  row: RepairStateRow | null | undefined,
  fluidId: MaintenanceFluidId,
): Date | string | null | undefined {
  switch (fluidId) {
    case "engineOil":
      return row?.engineOilFreeAvailableAt;
    case "engineOilFilter":
      return row?.engineOilFilterFreeAvailableAt;
    case "hydraulicOil":
      return row?.hydraulicOilFreeAvailableAt;
    case "hydraulicFilter":
      return row?.hydraulicFilterFreeAvailableAt;
    case "fuelFilter":
      return row?.fuelFilterFreeAvailableAt;
    case "gearOil":
      return row?.gearOilFreeAvailableAt;
  }
}

function buildFluidSnapshot(
  def: MaintenanceFluidDef,
  remaining: number,
  capacityMult: number,
  freeAvailableAt: Date | string | null | undefined,
  filledAt: Date | string | null | undefined,
): FluidSnapshot {
  const rem = clampRatio(remaining);
  const mult = Math.max(1, capacityMult || 1);
  const capacityMs = def.cycleHours * mult * HOUR_MS;
  const remainingMs = rem * capacityMs;
  return {
    id: def.id,
    label: def.label,
    remaining: rem,
    percent: Math.round(rem * 100),
    capacityMult: mult,
    wear: "calendar",
    freeAvailableAt: toIso(freeAvailableAt),
    filledAt: toIso(filledAt),
    remainingMeters: null,
    remainingDays: remainingMs / DAY_MS,
    remainingMs,
    cycleHours: def.cycleHours,
    depleted: rem <= 0,
    warning: rem > 0 && rem <= MAINTENANCE_WARN_RATIO,
    exchangeEligible: isExchangeEligible(rem),
  };
}

export function computeMaintenanceSnapshot(
  row: RepairStateRow | null | undefined,
  nowMs = Date.now(),
): MaintenanceSnapshot {
  const odometerMeters = Math.max(0, Number(row?.odometerMeters) || 0);
  const fluids = {} as Record<MaintenanceFluidId, FluidSnapshot>;

  for (const id of MAINTENANCE_FLUID_IDS) {
    const def = MAINTENANCE_FLUIDS[id];
    const mult = capacityMultForFluid(row, id);
    const rem = calendarRemainingRatio(
      filledAtForFluid(row, id),
      def.cycleHours,
      nowMs,
      mult,
    );
    fluids[id] = buildFluidSnapshot(
      def,
      rem,
      mult,
      freeAtForFluid(row, id),
      filledAtForFluid(row, id),
    );
  }

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

/**
 * @deprecated Distance wear retired — odometer only.
 * Kept so consume route can still record travel distance.
 */
export function applyTravelMeters(
  row: RepairStateRow,
  travelMeters: number,
): { odometerMeters: number } {
  const meters = Math.max(0, travelMeters);
  const odometerMeters = Math.max(0, Number(row.odometerMeters) || 0) + meters;
  return { odometerMeters };
}

export function fluidFilledAtField(
  fluidId: MaintenanceFluidId,
):
  | "engineOilFilledAt"
  | "engineOilFilterFilledAt"
  | "hydraulicOilFilledAt"
  | "hydraulicFilterFilledAt"
  | "fuelFilterFilledAt"
  | "gearOilFilledAt" {
  switch (fluidId) {
    case "engineOil":
      return "engineOilFilledAt";
    case "engineOilFilter":
      return "engineOilFilterFilledAt";
    case "hydraulicOil":
      return "hydraulicOilFilledAt";
    case "hydraulicFilter":
      return "hydraulicFilterFilledAt";
    case "fuelFilter":
      return "fuelFilterFilledAt";
    case "gearOil":
      return "gearOilFilledAt";
  }
}

export function fluidCapacityMultField(
  fluidId: MaintenanceFluidId,
):
  | "engineOilCapacityMult"
  | "engineOilFilterCapacityMult"
  | "hydraulicOilCapacityMult"
  | "hydraulicFilterCapacityMult"
  | "fuelFilterCapacityMult"
  | "gearOilCapacityMult" {
  switch (fluidId) {
    case "engineOil":
      return "engineOilCapacityMult";
    case "engineOilFilter":
      return "engineOilFilterCapacityMult";
    case "hydraulicOil":
      return "hydraulicOilCapacityMult";
    case "hydraulicFilter":
      return "hydraulicFilterCapacityMult";
    case "fuelFilter":
      return "fuelFilterCapacityMult";
    case "gearOil":
      return "gearOilCapacityMult";
  }
}

/** Reset timer after a free claim exchange. Capacity always ×1. */
export function buildServiceUpdate(
  fluidId: MaintenanceFluidId,
  now = new Date(),
): Record<string, number | Date | null> {
  const data: Record<string, number | Date | null> = {
    [fluidFilledAtField(fluidId)]: now,
    [fluidCapacityMultField(fluidId)]: 1,
  };
  if (fluidId === "engineOil") data.engineOilRemaining = 1;
  if (fluidId === "engineOilFilter") data.engineOilFilterRemaining = 1;
  return data;
}

/** Ensure all fluids have filledAt so remaining starts full for new rows. */
export function calendarFillDefaults(now = new Date()) {
  return {
    engineOilFilledAt: now,
    engineOilFilterFilledAt: now,
    hydraulicOilFilledAt: now,
    hydraulicFilterFilledAt: now,
    fuelFilterFilledAt: now,
    gearOilFilledAt: now,
    engineOilRemaining: 1,
    engineOilFilterRemaining: 1,
  };
}

/** Patch for any null/missing filledAt timestamps (start cycle at `now`). */
export function missingFilledAtPatch(
  repair: RepairStateRow | null | undefined,
  now = new Date(),
): Record<string, Date> {
  if (!repair) return { ...calendarFillDefaults(now) };
  const patch: Record<string, Date> = {};
  for (const id of MAINTENANCE_FLUID_IDS) {
    if (!filledAtForFluid(repair, id)) {
      patch[fluidFilledAtField(id)] = now;
    }
  }
  return patch;
}

/** Exchange allowed when remaining time is at/under this skew (client clocks). */
export const MAINTENANCE_CLAIM_SKEW_MS = 5_000;

export function isFluidExchangeReady(fluid: FluidSnapshot): boolean {
  return fluid.exchangeEligible || fluid.remainingMs <= MAINTENANCE_CLAIM_SKEW_MS;
}

export function mergeRewards(
  guaranteed: MaintenanceReward,
  bonus: MaintenanceBonusOutcome,
): {
  stars: number;
  enhanceCores: number;
  gachaTicketsStandard: number;
  gachaTicketsPremium: number;
  workshopPoints: number;
  xpGarnish: number;
} {
  return {
    stars: (guaranteed.stars || 0) + (bonus.stars || 0),
    enhanceCores:
      (guaranteed.enhanceCores || 0) + (bonus.enhanceCores || 0),
    gachaTicketsStandard:
      (guaranteed.gachaTicketsStandard || 0) +
      (bonus.gachaTicketsStandard || 0),
    gachaTicketsPremium:
      (guaranteed.gachaTicketsPremium || 0) +
      (bonus.gachaTicketsPremium || 0),
    workshopPoints:
      (guaranteed.workshopPoints || 0) + (bonus.workshopPoints || 0),
    xpGarnish: guaranteed.xpGarnish || 0,
  };
}
