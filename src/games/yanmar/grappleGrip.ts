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
export const GRAPPLE_BUCKET_ANGLE_MIN = 0.25;
export const GRAPPLE_BUCKET_ANGLE_MAX = 2.55;
/** 클램프 XZ 기준 돌 집기 반경 (시각·키네마틱 오차 흡수). */
export const GRAPPLE_GRAB_XZ_RADIUS = 2.85;
/** 붐이 바닥 근처일 때 집기용 클램프 지면 여유 상한. */
export const GRAPPLE_GROUND_PICKUP_MAX_CLEARANCE = 1.85;
const GRAPPLE_BUCKET_ANGLE_OPTIMAL =
  (GRAPPLE_BUCKET_ANGLE_MIN + GRAPPLE_BUCKET_ANGLE_MAX) / 2;
const GRAPPLE_BUCKET_ANGLE_HALF =
  (GRAPPLE_BUCKET_ANGLE_MAX - GRAPPLE_BUCKET_ANGLE_MIN) / 2;
/** 무게중심 정렬 허용 거리 — 넓을수록 comFactor가 쉽게 유지된다. */
const MAX_COM_ALIGN_DIST = 1.75;

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
    horizontalRadius: GRAPPLE_GRAB_XZ_RADIUS + scale * 0.25,
    verticalRadius: scale * 1.35 + 1.1,
    grabRadius: GRAPPLE_GRAB_XZ_RADIUS + scale * 0.35,
  };
}

export function hillBoulderWrapRadius(rock: HillBoulder): number {
  return hillBoulderGripEnvelope(rock).horizontalRadius;
}

export function grappleBucketAngleReady(bucket: number): boolean {
  return bucket >= GRAPPLE_BUCKET_ANGLE_MIN && bucket <= GRAPPLE_BUCKET_ANGLE_MAX;
}

/** 붐·클램프가 바닥 근처에서 돌 위로 내려온 집기 자세인지. */
export function isGrappleGroundPickupPose(
  clamp: { x: number; y: number; z: number },
  rock: HillBoulder,
  clampGroundY: number,
): boolean {
  const scale = hillBoulderVisualScale(rock.size);
  const envelope = hillBoulderGripEnvelope(rock);
  const xz = Math.hypot(clamp.x - rock.x, clamp.z - rock.z);
  const clearance = clamp.y - clampGroundY;
  return (
    xz <= envelope.horizontalRadius + 1.05 &&
    clearance >= -0.45 &&
    clearance <= GRAPPLE_GROUND_PICKUP_MAX_CLEARANCE &&
    clamp.y <= clampGroundY + scale * 1.15 + 1.25
  );
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
  // 크기·둥근 정도·각도 패널티를 더 줄여 밀착 확보를 완화한다. (압력 최대 시간은 3초 유지)
  const sizeFactor = 1 - clamp01(rock.size) * 0.38;
  const roundFactor = 1 - clamp01(rock.roundness) * 0.3;
  const angleFactor =
    1 -
    clamp01(
      Math.abs(bucketAngle - GRAPPLE_BUCKET_ANGLE_OPTIMAL) /
        Math.max(0.55, GRAPPLE_BUCKET_ANGLE_HALF),
    );

  const raw =
    Math.pow(pressure01 + 0.18, 0.65) *
    (0.52 + 0.48 * sizeFactor) *
    (0.52 + 0.48 * roundFactor) *
    (0.55 + 0.45 * clamp01(comFactor)) *
    (0.55 + 0.45 * angleFactor);

  // 바닥을 올려 짧은 조임으로도 판정권에 들어가게 한다.
  const adhesion01 = Math.max(0.24, Math.min(1, raw + adhesionBonus));

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
