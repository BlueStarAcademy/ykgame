import type { ExcavatorSimState } from "./types";
import { YANMAR_MACHINE_RIG } from "./machineVisualTheme";
import { GRAPPLE_GRAB_MIN_OPEN } from "./grappleGrip";

/**
 * 유압 엄지 최대 벌림 각도 (충돌 없을 때).
 * 실제 개폐는 `clampGrappleOpenAgainstArm`이 암과 겹치지 않는 한도까지만 허용한다.
 */
export const GRAPPLE_THUMB_MAX_OPEN_RAD = (100 * Math.PI) / 180;

const THUMB_HINGE_X = -0.08;
const THUMB_HINGE_Y = 0.2;

/**
 * 끝부분(팁)만 검사 — 힌지·크로스바 샘플은 닫힌 자세·얕은 컬에서
 * 암 AABB 오판으로 open을 0에 가깝게 막아 집기/압력이 불가능해진다.
 */
const THUMB_TIP_LOCALS: ReadonlyArray<readonly [number, number]> = [
  [-1.18, -0.42],
  [-1.11, -0.43],
  [-1.08, -0.48],
];

/** 암 링크 반높이(기본 차체)에 약간의 여유만. */
const ARM_HALF_HEIGHT = (0.36 * 1.0) / 2 + 0.02;
/** 버켓 핀 근처는 암 스틱으로 보지 않음 */
const ARM_JOINT_CLEARANCE = 0.7;
const ARM_ROOT_CLEARANCE = 0.25;
/** 열기 스캔 해상도 */
const OPEN_SCAN_STEPS = 48;

function thumbTipInArmLocal(
  bucketAngle: number,
  openAmount: number,
  localX: number,
  localY: number,
): { x: number; y: number } {
  const open = Math.max(0, Math.min(1, openAmount));
  const theta = -open * GRAPPLE_THUMB_MAX_OPEN_RAD;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const bx = THUMB_HINGE_X + cosT * localX - sinT * localY;
  const by = THUMB_HINGE_Y + sinT * localX + cosT * localY;

  const cosB = Math.cos(bucketAngle);
  const sinB = Math.sin(bucketAngle);
  return {
    x: YANMAR_MACHINE_RIG.armLength + cosB * bx - sinB * by,
    y: sinB * bx + cosB * by,
  };
}

export function grappleOpenHitsArm(
  sim: ExcavatorSimState,
  openAmount: number,
): boolean {
  const bucketAngle = sim.bucket * YANMAR_MACHINE_RIG.bucketRotationScale;
  const armLen = YANMAR_MACHINE_RIG.armLength;
  const xMin = ARM_ROOT_CLEARANCE;
  const xMax = armLen - ARM_JOINT_CLEARANCE;

  for (const [lx, ly] of THUMB_TIP_LOCALS) {
    const p = thumbTipInArmLocal(bucketAngle, openAmount, lx, ly);
    if (p.x >= xMin && p.x <= xMax && Math.abs(p.y) <= ARM_HALF_HEIGHT) {
      return true;
    }
  }
  return false;
}

/**
 * 닫힌 상태(0)에서 열 때 암에 처음 닿는 open 직전 값.
 * 비단조(중간에만 스치는) 경우를 이진 탐색 대신 순방향 스캔으로 처리.
 */
export function maxSafeGrappleOpen(sim: ExcavatorSimState): number {
  // 이미 닫혀 있어도 AABB에 걸리면(오판) 클램프하지 않음
  if (grappleOpenHitsArm(sim, 0)) return 1;
  if (!grappleOpenHitsArm(sim, 1)) return 1;

  for (let i = 1; i <= OPEN_SCAN_STEPS; i++) {
    const open = i / OPEN_SCAN_STEPS;
    if (grappleOpenHitsArm(sim, open)) {
      return Math.max(0, (i - 1) / OPEN_SCAN_STEPS - 0.01);
    }
  }
  return 1;
}

export function clampGrappleOpenAgainstArm(
  sim: ExcavatorSimState,
  openAmount: number,
): number {
  const open = Math.max(0, Math.min(1, openAmount));
  return Math.min(open, maxSafeGrappleOpen(sim));
}

/**
 * 집기 무장에 필요한 최소 개방.
 * 암 때문에 0.7까지 못 벌리는 자세에서는 그 자세의 안전 최대치 기준으로 완화.
 */
export function grappleOpenEnoughToGrab(
  sim: ExcavatorSimState,
  openAmount: number,
): boolean {
  const open = Math.max(0, Math.min(1, openAmount));
  const safeMax = maxSafeGrappleOpen(sim);
  const required = Math.min(
    GRAPPLE_GRAB_MIN_OPEN,
    Math.max(0.4, safeMax * 0.9),
  );
  return open >= required;
}
