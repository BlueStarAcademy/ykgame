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
      dpr: [1, 1],
      shadows: "percentage",
      shadowMapSize: 1024,
      shadowCameraExtent: 90,
      antialias: false,
      contactShadows: false,
      contactShadowResolution: 256,
      paintClearcoat: 0,
      paintEnvMapIntensity: 0.35,
      minimapMaxDpr: 1.25,
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
