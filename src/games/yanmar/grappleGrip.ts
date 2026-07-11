import {
  hillBoulderVisualScale,
  type HillBoulder,
} from "./terrain";

/** 닫기 페달 유지 이 시간(초) 이상이면 압력 최대. */
export const GRAPPLE_PRESSURE_MAX_SEC = 3;
/** 운반 중 팁이 이보다 낮으면 주행 잠금. */
export const GRAPPLE_TRAVEL_LOCK_CLEARANCE = 0.32;
/** The visible jaws can enclose a rock throughout this practical curl range. */
export const GRAPPLE_BUCKET_ANGLE_MIN = 0.35;
export const GRAPPLE_BUCKET_ANGLE_MAX = 1.75;
const GRAPPLE_BUCKET_ANGLE_OPTIMAL =
  (GRAPPLE_BUCKET_ANGLE_MIN + GRAPPLE_BUCKET_ANGLE_MAX) / 2;
const GRAPPLE_BUCKET_ANGLE_HALF =
  (GRAPPLE_BUCKET_ANGLE_MAX - GRAPPLE_BUCKET_ANGLE_MIN) / 2;
const MAX_COM_ALIGN_DIST = 1.15;

export interface GrappleGripRuntime {
  adhesion01: number;
  pressure01: number;
  contactElapsed: number;
  locked: boolean;
  liftChecked: boolean;
  /** 집는 순간·클램프 중 무게중심 정렬 (0~1). */
  comFactor: number;
  liftResult: null | "success" | "fail";
  liftResultTick: number;
}

export function createGrappleGripRuntime(): GrappleGripRuntime {
  return {
    adhesion01: 0.01,
    pressure01: 0,
    contactElapsed: 0,
    locked: false,
    liftChecked: false,
    comFactor: 0.5,
    liftResult: null,
    liftResultTick: 0,
  };
}

export function resetGrappleGrip(grip: GrappleGripRuntime) {
  Object.assign(grip, createGrappleGripRuntime());
}

export { hillBoulderVisualScale } from "./terrain";

/** Rendered ellipsoid bounds plus clearance for flat-ground grapple pickup. */
export function hillBoulderGripEnvelope(rock: HillBoulder): {
  horizontalRadius: number;
  verticalRadius: number;
} {
  const scale = hillBoulderVisualScale(rock.size);
  return {
    // Match the old wrap feel (scale * 1.35) with extra reach on flat ground.
    horizontalRadius: scale * 1.45 + 0.45,
    verticalRadius: scale * 1.15 + 0.4,
  };
}

export function hillBoulderWrapRadius(rock: HillBoulder): number {
  return hillBoulderGripEnvelope(rock).horizontalRadius;
}

export function grappleBucketAngleReady(bucket: number): boolean {
  return bucket >= GRAPPLE_BUCKET_ANGLE_MIN && bucket <= GRAPPLE_BUCKET_ANGLE_MAX;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export function computeGrappleAdhesion(params: {
  rock: HillBoulder;
  contactElapsed: number;
  bucketAngle: number;
  comFactor: number;
  /** 집게 강화 보너스 (0~0.3). 합산 후 최대 1(100%). */
  adhesionBonus?: number;
}): { adhesion01: number; pressure01: number } {
  const { rock, contactElapsed, bucketAngle, comFactor, adhesionBonus = 0 } = params;
  const pressure01 = clamp01(contactElapsed / GRAPPLE_PRESSURE_MAX_SEC);
  const sizeFactor = 1 - clamp01(rock.size) * 0.85;
  const roundFactor = 1 - clamp01(rock.roundness) * 0.75;
  const angleFactor =
    1 -
    clamp01(
      Math.abs(bucketAngle - GRAPPLE_BUCKET_ANGLE_OPTIMAL) /
        GRAPPLE_BUCKET_ANGLE_HALF,
    );

  const raw =
    Math.pow(pressure01 + 0.04, 0.85) *
    (0.22 + 0.78 * sizeFactor) *
    (0.22 + 0.78 * roundFactor) *
    (0.3 + 0.7 * clamp01(comFactor)) *
    (0.3 + 0.7 * angleFactor);

  const adhesion01 = Math.max(0.01, Math.min(1, raw + adhesionBonus));

  return { adhesion01, pressure01 };
}

export function computeComAlignFactor(
  rock: HillBoulder,
  clampX: number,
  clampZ: number,
): number {
  const comX = rock.x + rock.comOffsetX;
  const comZ = rock.z + rock.comOffsetZ;
  const comDist = Math.hypot(clampX - comX, clampZ - comZ);
  return 1 - clamp01(comDist / MAX_COM_ALIGN_DIST);
}
