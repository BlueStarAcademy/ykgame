/**
 * Runtime graphics preset for the excavator WebGL scene.
 * Defaults to "performance" — desktop previously auto-selected "high"
 * (low DPR + many cores) and stuttered worse than phones.
 */

export type GraphicsQuality = "high" | "performance";

const STORAGE_KEY = "ykgame:yanmar:graphics-quality:v2";

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

/**
 * CSS pixel area of the immersive play surface.
 * Desktop uses a phone-width frame (max ~28rem), so budget against that —
 * not the full monitor — or tall windows still blow the backbuffer.
 */
function estimatePlaySurfaceCssPixels(): number {
  if (typeof window === "undefined") return 1280 * 720;
  const frameW = Math.min(window.innerWidth || 1280, 28 * 16);
  const frameH = Math.min(window.innerHeight || 720, 52 * 16);
  return Math.max(1, frameW * frameH);
}

function dprCapForBudget(budget: number, hardCap: number): number {
  if (typeof window === "undefined") return 1;
  const deviceDpr = window.devicePixelRatio || 1;
  if (deviceDpr <= 1.05) return 1;
  const budgetCap = Math.sqrt(budget / estimatePlaySurfaceCssPixels());
  const cap = Math.min(deviceDpr, hardCap, budgetCap);
  // Round to 0.05 so resizes don't churn the backbuffer.
  return Math.max(1, Math.round(cap * 20) / 20);
}

const PERFORMANCE_PIXEL_BUDGET = 1_150_000;
const PERFORMANCE_DPR_CAP = 1.75;
const HIGH_PIXEL_BUDGET = 1_800_000;
const HIGH_DPR_CAP = 1.35;

export function getGraphicsQuality(): GraphicsQuality {
  return readStored() ?? "performance";
}

export function setGraphicsQuality(quality: GraphicsQuality): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, quality);
  } catch {
    // ignore
  }
  profileCache.clear();
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

/**
 * Profiles are read during render (materials, minimap), so hand back a stable
 * object per tier. New identities every render churn R3F prop diffing and can
 * retrigger renderer configuration.
 */
const profileCache = new Map<GraphicsQuality, GraphicsProfile>();

function buildProfile(quality: GraphicsQuality): GraphicsProfile {
  if (quality === "performance") {
    return {
      quality,
      dpr: [1, dprCapForBudget(PERFORMANCE_PIXEL_BUDGET, PERFORMANCE_DPR_CAP)],
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
    dpr: [1, dprCapForBudget(HIGH_PIXEL_BUDGET, HIGH_DPR_CAP)],
    shadows: "percentage",
    // 2048² shadows were a major desktop hitch; 1024 is enough at phone-frame size.
    shadowMapSize: 1024,
    shadowCameraExtent: 110,
    antialias: true,
    contactShadows: false,
    contactShadowResolution: 512,
    paintClearcoat: 0.35,
    paintEnvMapIntensity: 0.7,
    minimapMaxDpr: 1.75,
    minimapFps: 20,
  };
}

export function getGraphicsProfile(
  quality: GraphicsQuality = getGraphicsQuality(),
): GraphicsProfile {
  const cached = profileCache.get(quality);
  if (cached) return cached;
  const profile = buildProfile(quality);
  profileCache.set(quality, profile);
  return profile;
}
