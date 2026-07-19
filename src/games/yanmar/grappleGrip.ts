import {
  hillBoulderVisualScale,
  type HillBoulder,
} from "./terrain";

/** 닫기 페달 유지 이 시간(초) 이상이면 압력 최대. */
export const GRAPPLE_PRESSURE_MAX_SEC = 3;
/** 운반 중 팁이 이보다 낮으면 주행 잠금. */
export const GRAPPLE_TRAVEL_LOCK_CLEARANCE = 0.32;
/** 밀착 확정 시점 대비 이만큼 더 들어야 적재 성공/실패 판정. */
export const GRAPPLE_LIFT_JUDGE_CLEARANCE_DELTA = 0.45;
/** The visible jaws can enclose a rock throughout this practical curl range. */
export const GRAPPLE_BUCKET_ANGLE_MIN = 0.35;
export const GRAPPLE_BUCKET_ANGLE_MAX = 2.4;
/** 클램프·집게 샘플 XZ 기준 돌 근접 반경 (땅에 내린 집게 근처). */
export const GRAPPLE_GRAB_XZ_RADIUS = 1.55;
/** 이 이상 열려 있을 때만 접기(닫기)로 돌을 집을 수 있다. 0=닫힘, 1=완전 열림. */
export const GRAPPLE_GRAB_MIN_OPEN = 0.7;
/**
 * 집게를 땅에 완전히 내린 것으로 볼 지면 여유 상한.
 * (공중 집기 방지 — 돌 바로 위일 필요는 없음)
 */
export const GRAPPLE_FULLY_LOWERED_MAX_CLEARANCE = 0.45;
/**
 * 집기용 클램프 지면 여유 기본 상한 (작은 돌 기준).
 * 실제 판정은 {@link grapplePickupMaxClearance}로 돌 크기를 반영한다.
 */
export const GRAPPLE_GROUND_PICKUP_MAX_CLEARANCE = 0.82;
const GRAPPLE_BUCKET_ANGLE_OPTIMAL =
  (GRAPPLE_BUCKET_ANGLE_MIN + GRAPPLE_BUCKET_ANGLE_MAX) / 2;
const GRAPPLE_BUCKET_ANGLE_HALF =
  (GRAPPLE_BUCKET_ANGLE_MAX - GRAPPLE_BUCKET_ANGLE_MIN) / 2;
/** 무게중심 정렬 허용 거리 — 좁을수록 중앙 정렬이 더 필요하다. */
const MAX_COM_ALIGN_DIST = 1.3;

export interface GrappleGripRuntime {
  adhesion01: number;
  pressure01: number;
  contactElapsed: number;
  locked: boolean;
  liftChecked: boolean;
  /** 밀착 확정 순간의 클램프 지면 여유 — 붐 리프트 판정 기준. */
  clearanceAtLock: number | null;
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
    clearanceAtLock: null,
    comFactor: 0.5,
    liftResult: null,
    liftResultTick: 0,
  };
}

export function resetGrappleGrip(grip: GrappleGripRuntime) {
  Object.assign(grip, createGrappleGripRuntime());
}

export { hillBoulderVisualScale } from "./terrain";

/** Rendered boulder bounds plus clearance for flat-ground grapple pickup. */
export function hillBoulderGripEnvelope(rock: HillBoulder): {
  horizontalRadius: number;
  verticalRadius: number;
  grabRadius: number;
} {
  const scale = hillBoulderVisualScale(rock.size);
  return {
    horizontalRadius: GRAPPLE_GRAB_XZ_RADIUS + scale * 0.18,
    /** 돌 본체 높이 근처만 — 공중 샘플이 잡히지 않게. */
    verticalRadius: scale * 0.7 + 0.38,
    grabRadius: GRAPPLE_GRAB_XZ_RADIUS + scale * 0.22,
  };
}

export function hillBoulderWrapRadius(rock: HillBoulder): number {
  return hillBoulderGripEnvelope(rock).horizontalRadius;
}

/**
 * Jaw open rest while gripping a rock (0=shut, 1=wide).
 * Larger rocks keep the thumb visibly less closed; pressure builds against this stop.
 */
export function grappleClampOpenForRock(rock: HillBoulder): number {
  const size01 = Math.max(0, Math.min(1, rock.size));
  // size 0 → ~12% open, size 1 → ~48% open
  return 0.12 + size01 * 0.36;
}

export function grappleBucketAngleReady(bucket: number): boolean {
  return bucket >= GRAPPLE_BUCKET_ANGLE_MIN && bucket <= GRAPPLE_BUCKET_ANGLE_MAX;
}

/** 클램프가 돌이 있는 지면 근처에 내려와 있는지. */
export function grapplePickupMaxClearance(rock: HillBoulder): number {
  const scale = hillBoulderVisualScale(rock.size);
  // 돌 꼭대기보다 약간 위까지 — 공중(수 m) 집기는 막고 바닥 집기 자세는 허용.
  return Math.max(GRAPPLE_GROUND_PICKUP_MAX_CLEARANCE, scale + 0.28);
}

export function isGrappleClampNearGround(
  clampY: number,
  groundY: number,
  rock?: HillBoulder,
): boolean {
  const maxClearance = rock
    ? grapplePickupMaxClearance(rock)
    : GRAPPLE_GROUND_PICKUP_MAX_CLEARANCE;
  const clearance = clampY - groundY;
  return clearance >= -0.08 && clearance <= maxClearance;
}

/** 집게 끝(가장 낮은 샘플)이 지면에 완전히 내려와 있는지. */
export function isGrappleFullyLoweredToGround(
  lowestToolY: number,
  groundY: number,
): boolean {
  const clearance = lowestToolY - groundY;
  return (
    clearance >= -0.1 && clearance <= GRAPPLE_FULLY_LOWERED_MAX_CLEARANCE
  );
}

function nearestGrappleHorizontalDist(
  rock: HillBoulder,
  clamp: { x: number; z: number },
  jawSamples?: ReadonlyArray<{ x: number; z: number }>,
): number {
  let best = Math.hypot(clamp.x - rock.x, clamp.z - rock.z);
  if (!jawSamples) return best;
  for (const point of jawSamples) {
    const d = Math.hypot(point.x - rock.x, point.z - rock.z);
    if (d < best) best = d;
  }
  return best;
}

/**
 * 집게를 땅에 완전히 내린 상태에서 돌이 집게 근처에 있으면 집기 자세.
 * 돌 바로 위일 필요는 없고, 클램프·이빨·엄지 샘플 중 하나라도 가까우면 된다.
 */
export function isGrappleGroundPickupPose(
  clamp: { x: number; y: number; z: number },
  rock: HillBoulder,
  toolGroundY: number,
  jawSamples: ReadonlyArray<{ x: number; y: number; z: number }> = [],
): boolean {
  const points = jawSamples.length > 0 ? jawSamples : [clamp];
  const lowestY = Math.min(clamp.y, ...points.map((p) => p.y));
  if (!isGrappleFullyLoweredToGround(lowestY, toolGroundY)) {
    return false;
  }

  const envelope = hillBoulderGripEnvelope(rock);
  const nearRadius = envelope.horizontalRadius + 0.4;
  return nearestGrappleHorizontalDist(rock, clamp, points) <= nearRadius;
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
  // 3초 도달 시 정확히 1로 스냅 (부동소수로 0.99x에 멈추지 않게).
  const pressure01 =
    contactElapsed >= GRAPPLE_PRESSURE_MAX_SEC
      ? 1
      : clamp01(contactElapsed / GRAPPLE_PRESSURE_MAX_SEC);
  // 압력 최대(3초)는 유지하고, 자세·크기·무게중심 조건은 조금 더 까다롭게.
  const sizeFactor = 1 - clamp01(rock.size) * 0.55;
  const roundFactor = 1 - clamp01(rock.roundness) * 0.45;
  const angleFactor =
    1 -
    clamp01(
      Math.abs(bucketAngle - GRAPPLE_BUCKET_ANGLE_OPTIMAL) /
        Math.max(0.42, GRAPPLE_BUCKET_ANGLE_HALF),
    );

  const raw =
    Math.pow(pressure01 + 0.06, 0.78) *
    (0.38 + 0.62 * sizeFactor) *
    (0.38 + 0.62 * roundFactor) *
    (0.32 + 0.68 * clamp01(comFactor)) *
    (0.32 + 0.68 * angleFactor);

  const adhesion01 = Math.max(0.08, Math.min(1, raw + adhesionBonus));

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
