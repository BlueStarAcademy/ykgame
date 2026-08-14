/**
 * Runtime graphics preset for the excavator WebGL scene.
 * Dev / weak GPUs default to "performance" so local play stays controllable.
 */

export type GraphicsQuality = "high" | "performance";

const STORAGE_KEY = "ykgame:yanmar:graphics-quality:v1";

function readStored(): GraphicsQuality | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "high" || raw === "performance") return raw;
  } catch {
    // ignore
  }
  return null;
}

/** Prefer performance under Next.js dev (HMR + unminified = heavy). */
function preferPerformanceByDefault(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency || 4;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  // Integrated / low-end heuristics — not perfect, but safer than locking up.
  return cores <= 4 || dpr >= 2;
}

/**
 * Backbuffer pixel budget for the performance tier.
 * Rendering at dpr 1 on a 3x phone screen is cheap but visibly upscaled, so
 * spend the same pixel budget everywhere instead of pinning to CSS pixels:
 * small viewports (phones) get supersampled back toward native, while large
 * retina desktops stay at dpr 1 as before.
 */
const PERFORMANCE_PIXEL_BUDGET = 1_150_000;
const PERFORMANCE_DPR_CAP = 1.75;

function performanceDprCap(): number {
  if (typeof window === "undefined") return 1;
  const deviceDpr = window.devicePixelRatio || 1;
  if (deviceDpr <= 1.05) return 1;
  const cssPixels = Math.max(
    1,
    (window.innerWidth || 1280) * (window.innerHeight || 720),
  );
  const budgetCap = Math.sqrt(PERFORMANCE_PIXEL_BUDGET / cssPixels);
  const cap = Math.min(deviceDpr, PERFORMANCE_DPR_CAP, budgetCap);
  // Round to 0.05 so resizes don't churn the backbuffer.
  return Math.max(1, Math.round(cap * 20) / 20);
}

export function getGraphicsQuality(): GraphicsQuality {
  return readStored() ?? (preferPerformanceByDefault() ? "performance" : "high");
}

export function setGraphicsQuality(quality: GraphicsQuality): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, quality);
  } catch {
    // ignore
  }
}

export type GraphicsProfile = {
  quality: GraphicsQuality;
  /** R3F Canvas dpr range */
  dpr: [number, number];
  /**
   * R3F Canvas shadows prop.
   * Use "percentage" (PCFShadowMap). Avoid `true` / "soft" — those map to
   * deprecated PCFSoftShadowMap; Three warns every shadow pass and R3F resets
   * the type on each Canvas configure, so the console counter explodes.
   */
  shadows: false | "percentage" | "basic" | "variance";
  shadowMapSize: number;
  shadowCameraExtent: number;
  antialias: boolean;
  contactShadows: boolean;
  contactShadowResolution: number;
  /** meshPhysical clearcoat (costly on many excavator parts). */
  paintClearcoat: number;
  paintEnvMapIntensity: number;
  minimapMaxDpr: number;
  minimapFps: number;
};

export function getGraphicsProfile(
  quality: GraphicsQuality = getGraphicsQuality(),
): GraphicsProfile {
  if (quality === "performance") {
    return {
      quality,
      dpr: [1, performanceDprCap()],
      shadows: "percentage",
      shadowMapSize: 1024,
      shadowCameraExtent: 90,
      antialias: false,
      contactShadows: false,
      contactShadowResolution: 256,
      paintClearcoat: 0,
      paintEnvMapIntensity: 0.35,
      minimapMaxDpr: 1.5,
      minimapFps: 12,
    };
  }
  return {
    quality,
    dpr: [1, 1.5],
    shadows: "percentage",
    shadowMapSize: 2048,
    shadowCameraExtent: 125,
    antialias: true,
    contactShadows: true,
    contactShadowResolution: 512,
    paintClearcoat: 0.55,
    paintEnvMapIntensity: 0.85,
    minimapMaxDpr: 2,
    minimapFps: 30,
  };
}
