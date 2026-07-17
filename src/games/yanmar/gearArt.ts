import type { ChassisClass, ChassisModelId } from "./chassisCatalog";
import { getChassisDef } from "./chassisCatalog";
import type { GearSlot, ItemGrade } from "./gearCatalog";

const SLOT_FILE: Record<GearSlot, string> = {
  ARM: "arm",
  BOOM: "boom",
  TRACK: "track",
  BUCKET: "bucket",
  BREAKER: "breaker",
  GRAPPLE: "grapple",
};

const GRADE_FILE: Record<ItemGrade, string> = {
  NORMAL: "normal",
  ENHANCED: "enhanced",
  PRECISION: "precision",
  MASTER: "master",
};

const CHASSIS_MODEL_THUMB_VERSION = 13;

export function gearIconSrc(
  slot: GearSlot,
  grade: ItemGrade | null | undefined = "NORMAL",
): string {
  const gradeKey = grade && GRADE_FILE[grade] ? GRADE_FILE[grade] : "normal";
  return `/images/yanmar/2d/gear/${SLOT_FILE[slot]}-${gradeKey}.png?v=7`;
}

export function gearEmptySlotSrc(): string {
  return "/images/yanmar/2d/gear/empty-slot.png?v=7";
}

export function gradeFrameClass(grade: ItemGrade | null | undefined): string {
  if (!grade) return "yanmar-gear-frame yanmar-gear-frame--empty";
  switch (grade) {
    case "NORMAL":
      return "yanmar-gear-frame yanmar-gear-frame--normal";
    case "ENHANCED":
      return "yanmar-gear-frame yanmar-gear-frame--enhanced";
    case "PRECISION":
      return "yanmar-gear-frame yanmar-gear-frame--precision";
    case "MASTER":
      return "yanmar-gear-frame yanmar-gear-frame--master";
    default:
      return "yanmar-gear-frame yanmar-gear-frame--empty";
  }
}

export function chassisThumbSrc(chassisClass: ChassisClass): string {
  switch (chassisClass) {
    case "LIGHT":
      return "/images/yanmar/2d/chassis/light.png?v=3";
    case "HEAVY":
      return "/images/yanmar/2d/chassis/heavy.png?v=3";
    default:
      return "/images/yanmar/2d/chassis/medium.png?v=3";
  }
}

/** Per-model catalog thumb (YK 미니굴삭기 13종). */
export function chassisModelThumbSrc(
  chassisId: ChassisModelId | string | null | undefined,
): string {
  const def = getChassisDef(chassisId ?? "ViO17_1");
  return `/images/yanmar/2d/chassis/models/${def.id}.png?v=${CHASSIS_MODEL_THUMB_VERSION}`;
}

export function gachaBannerChromeClass(
  banner: "STANDARD" | "PREMIUM",
): string {
  return banner === "PREMIUM"
    ? "yanmar-gacha-card yanmar-gacha-card--premium"
    : "yanmar-gacha-card yanmar-gacha-card--standard";
}

export function gachaBannerArtSrc(banner: "STANDARD" | "PREMIUM"): string {
  return banner === "PREMIUM"
    ? "/images/yanmar/2d/shop/gacha-premium.png"
    : "/images/yanmar/2d/shop/gacha-standard.png";
}
