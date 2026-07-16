import type { ChassisClass, ChassisModelId } from "./chassisCatalog";
import { DEFAULT_CHASSIS_ID, getChassisDef } from "./chassisCatalog";

export type ChassisCabStyle = "open" | "rollbar" | "canopy" | "enclosed";
export type RollbarVariant = "single" | "arch";
export type CanopyVariant = "twoPost" | "fourPost";
/** Mini excavators use continuous rubber belts; heavy class uses steel links. */
export type ChassisTrackType = "rubber" | "steel";
export type IdlerStyle = "smooth" | "rim";
export type SprocketStyle = "miniHub" | "largeTooth";

export interface ChassisVisualProfile {
  id: ChassisModelId;
  /** Uniform visual scale relative to the default ViO17 body */
  scale: number;
  cabStyle: ChassisCabStyle;
  rollbarVariant?: RollbarVariant;
  canopyVariant?: CanopyVariant;
  /** Counterweight / rear bulk multiplier */
  bodyBulk: number;
  /** Track undercarriage width/length multiplier */
  trackWidth: number;
  /** Boom/link thickness multiplier (visual only) */
  boomThickness: number;
  /** Side brand / model plate text */
  modelPlate: string;
  trackType: ChassisTrackType;
  idlerStyle: IdlerStyle;
  sprocketStyle: SprocketStyle;
  /** Bottom track roller count (excluding idler / sprocket) */
  rollerCount: number;
}

function trackDefaults(
  chassisClass: ChassisClass,
  rollerCount: number,
): Pick<
  ChassisVisualProfile,
  "trackType" | "idlerStyle" | "sprocketStyle" | "rollerCount"
> {
  if (chassisClass === "HEAVY") {
    return {
      trackType: "steel",
      idlerStyle: "rim",
      sprocketStyle: "largeTooth",
      rollerCount,
    };
  }
  return {
    trackType: "rubber",
    idlerStyle: "smooth",
    sprocketStyle: "miniHub",
    rollerCount,
  };
}

const PROFILES: Record<ChassisModelId, ChassisVisualProfile> = {
  SV08_1C: {
    id: "SV08_1C",
    scale: 0.9,
    cabStyle: "open",
    bodyBulk: 0.9,
    trackWidth: 0.92,
    boomThickness: 0.9,
    modelPlate: "SV08-1C",
    ...trackDefaults("LIGHT", 2),
  },
  SV10: {
    id: "SV10",
    scale: 0.92,
    cabStyle: "open",
    bodyBulk: 0.93,
    trackWidth: 0.94,
    boomThickness: 0.92,
    modelPlate: "SV10",
    ...trackDefaults("LIGHT", 2),
  },
  SV11: {
    id: "SV11",
    scale: 0.94,
    cabStyle: "rollbar",
    rollbarVariant: "single",
    bodyBulk: 0.95,
    trackWidth: 0.96,
    boomThickness: 0.94,
    modelPlate: "SV11",
    ...trackDefaults("LIGHT", 3),
  },
  ViO12_2A: {
    id: "ViO12_2A",
    scale: 0.96,
    cabStyle: "rollbar",
    rollbarVariant: "arch",
    bodyBulk: 0.97,
    trackWidth: 0.97,
    boomThickness: 0.96,
    modelPlate: "ViO12-2A",
    ...trackDefaults("LIGHT", 3),
  },
  ViO17_1: {
    id: "ViO17_1",
    scale: 1,
    cabStyle: "canopy",
    canopyVariant: "twoPost",
    bodyBulk: 1,
    trackWidth: 1,
    boomThickness: 1,
    modelPlate: "ViO17-1",
    ...trackDefaults("MEDIUM", 3),
  },
  ViO20_6: {
    id: "ViO20_6",
    scale: 1.03,
    cabStyle: "canopy",
    canopyVariant: "twoPost",
    bodyBulk: 1.04,
    trackWidth: 1.03,
    boomThickness: 1.03,
    modelPlate: "ViO20-6",
    ...trackDefaults("MEDIUM", 3),
  },
  ViO23_6: {
    id: "ViO23_6",
    scale: 1.05,
    cabStyle: "canopy",
    canopyVariant: "twoPost",
    bodyBulk: 1.06,
    trackWidth: 1.05,
    boomThickness: 1.04,
    modelPlate: "ViO23-6",
    ...trackDefaults("MEDIUM", 3),
  },
  ViO25_6A: {
    id: "ViO25_6A",
    scale: 1.07,
    cabStyle: "canopy",
    canopyVariant: "fourPost",
    bodyBulk: 1.08,
    trackWidth: 1.06,
    boomThickness: 1.06,
    modelPlate: "ViO25-6A",
    ...trackDefaults("MEDIUM", 4),
  },
  ViO35_74: {
    id: "ViO35_74",
    scale: 1.1,
    cabStyle: "canopy",
    canopyVariant: "fourPost",
    bodyBulk: 1.12,
    trackWidth: 1.08,
    boomThickness: 1.08,
    modelPlate: "ViO35-7A",
    ...trackDefaults("MEDIUM", 4),
  },
  ViO35_7A_CJR: {
    id: "ViO35_7A_CJR",
    scale: 1.1,
    cabStyle: "enclosed",
    bodyBulk: 1.14,
    trackWidth: 1.08,
    boomThickness: 1.08,
    modelPlate: "ViO35-7A-CJR",
    ...trackDefaults("MEDIUM", 4),
  },
  ViO55_6A: {
    id: "ViO55_6A",
    scale: 1.14,
    cabStyle: "enclosed",
    bodyBulk: 1.2,
    trackWidth: 1.12,
    boomThickness: 1.12,
    modelPlate: "ViO55-6A",
    ...trackDefaults("HEAVY", 4),
  },
  ViO80_7: {
    id: "ViO80_7",
    scale: 1.17,
    cabStyle: "enclosed",
    bodyBulk: 1.26,
    trackWidth: 1.16,
    boomThickness: 1.16,
    modelPlate: "ViO80-7",
    ...trackDefaults("HEAVY", 5),
  },
  SV100_7: {
    id: "SV100_7",
    scale: 1.2,
    cabStyle: "enclosed",
    bodyBulk: 1.32,
    trackWidth: 1.2,
    boomThickness: 1.2,
    modelPlate: "SV100-7",
    ...trackDefaults("HEAVY", 5),
  },
};

export function getChassisVisualProfile(
  id: ChassisModelId | string | null | undefined,
): ChassisVisualProfile {
  if (id && id in PROFILES) return PROFILES[id as ChassisModelId];
  return PROFILES[DEFAULT_CHASSIS_ID];
}

export function chassisCabStyleForClass(chassisClass: ChassisClass): ChassisCabStyle {
  switch (chassisClass) {
    case "LIGHT":
      return "rollbar";
    case "HEAVY":
      return "enclosed";
    default:
      return "canopy";
  }
}

/** Convenience: resolve profile from any chassis id string. */
export function resolveChassisVisual(
  id: ChassisModelId | string | null | undefined,
): ChassisVisualProfile {
  const def = getChassisDef(id ?? DEFAULT_CHASSIS_ID);
  return getChassisVisualProfile(def.id);
}

/** All profiles for tooling / portrait generation. */
export function listChassisVisualProfiles(): ChassisVisualProfile[] {
  return Object.values(PROFILES);
}
