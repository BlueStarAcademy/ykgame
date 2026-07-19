import type { ChassisClass, ChassisModelId } from "./chassisCatalog";
import { getChassisDef } from "./chassisCatalog";
import {
  GEAR_SLOTS,
  type GearSlot,
  type ItemGrade,
} from "./gearCatalog";

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

const ITEM_GRADES = Object.keys(GRADE_FILE) as ItemGrade[];

const CHASSIS_MODEL_THUMB_VERSION = 13;

const preloadedIconUrls = new Set<string>();

export function gearIconSrc(
  slot: GearSlot,
  grade: ItemGrade | null | undefined = "NORMAL",
): string {
  const gradeKey = grade && GRADE_FILE[grade] ? GRADE_FILE[grade] : "normal";
  return `/images/yanmar/2d/gear/${SLOT_FILE[slot]}-${gradeKey}.png?v=13`;
}

export function gearEmptySlotSrc(): string {
  return "/images/yanmar/2d/gear/empty-slot.png?v=13";
}

/** 가챠·인벤에 쓰는 장비 아이콘 URL 전체 (6슬롯×4등급). */
export function allGearIconSrcs(): string[] {
  const urls: string[] = [gearEmptySlotSrc()];
  for (const slot of GEAR_SLOTS) {
    for (const grade of ITEM_GRADES) {
      urls.push(gearIconSrc(slot, grade));
    }
  }
  return urls;
}

export function preloadImage(src: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (preloadedIconUrls.has(src)) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new window.Image();
    img.decoding = "async";
    img.onload = () => {
      preloadedIconUrls.add(src);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = src;
  });
}

/** 상점/가챠 진입 시 아이콘 세트를 미리 받아 10연 연출 끊김을 줄인다. */
export function preloadAllGearIcons(): Promise<void> {
  return Promise.all(allGearIconSrcs().map(preloadImage)).then(() => undefined);
}

export function preloadGearIconSrcs(srcs: readonly string[]): Promise<void> {
  const unique = [...new Set(srcs)];
  return Promise.all(unique.map(preloadImage)).then(() => undefined);
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
