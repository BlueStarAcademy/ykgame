import type { ExcavatorSimState } from "./ExcavatorScene";
import { YANMAR_MACHINE_RIG } from "./machineVisualTheme";

const {
  boomLength: BOOM_LEN,
  armLength: ARM_LEN,
  bucketLength: BUCKET_LEN,
  boomPivotY: BOOM_PIVOT_Y,
  boomOffset: BOOM_OFFSET,
  armRotationScale: VISUAL_ARM_ROTATION_SCALE,
  bucketRotationScale: VISUAL_BUCKET_ROTATION_SCALE,
} = YANMAR_MACHINE_RIG;

/** 이 비율 미만이면 적재 불가·급격 유실 */
export const BUCKET_SOIL_HOLD_MIN = 0.16;
/** 이 각도 이하로 말리면 만재(100%) 유지 — 더 말수록 유지율이 떨어지지 않음 */
const SOIL_CURL_FULL = 0.75;
/** 이 각도 이상 펴면 유지율 0 */
const SOIL_CURL_EMPTY = 1.62;
/**
 * 월드 바가지 각도: 이 값보다 낮을수록(입구가 아래로)만 감점.
 * 말림으로 각도가 커지는 쪽은 감점하지 않음(한쪽 페널티).
 */
const SOIL_CUP_SAFE = 1.15;
const SOIL_CUP_SPILL = -0.35;

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

/** 붐·암·버킷 월드 자세 기준 흙 유지 가능 비율 (0=전부 유실, 1=만재 유지) */
export function getBucketSoilRetention(boom: number, arm: number, bucket: number): number {
  // 충분히 말린 버킷은 붐·암 자세와 무관하게 만재 유지
  if (bucket <= SOIL_CURL_FULL) return 1;

  const visualArmAngle = boom - arm * VISUAL_ARM_ROTATION_SCALE;
  const visualBucketAngle = visualArmAngle - bucket * VISUAL_BUCKET_ROTATION_SCALE;

  // 버킷 관절이 말릴수록 담김 (펴질수록 0)
  const curl = clamp01((SOIL_CURL_EMPTY - bucket) / (SOIL_CURL_EMPTY - SOIL_CURL_FULL));
  // 입구가 아래로 열린 자세만 감점 (과말림 감점 없음)
  const cup = clamp01((visualBucketAngle - SOIL_CUP_SPILL) / (SOIL_CUP_SAFE - SOIL_CUP_SPILL));

  return clamp01(curl * cup);
}

export interface BucketTip {
  x: number;
  y: number;
  z: number;
}

function bucketPointWorld(sim: ExcavatorSimState, boomSwing: number, localX: number, localY: number): BucketTip {
  const facing = sim.heading + sim.swing + boomSwing * 0.38;
  const boomEndX = Math.sin(sim.boom) * BOOM_LEN;
  const boomEndY = Math.cos(sim.boom) * BOOM_LEN;
  const visualArmAngle = sim.boom - sim.arm * VISUAL_ARM_ROTATION_SCALE;
  const visualBucketAngle = visualArmAngle - sim.bucket * VISUAL_BUCKET_ROTATION_SCALE;
  const armEndX = boomEndX + Math.sin(visualArmAngle) * ARM_LEN;
  const armEndY = boomEndY + Math.cos(visualArmAngle) * ARM_LEN;
  const bucketAngle = visualBucketAngle;
  const reach = armEndX + Math.sin(bucketAngle) * localX - Math.cos(bucketAngle) * localY;
  const height =
    BOOM_PIVOT_Y +
    armEndY +
    Math.cos(bucketAngle) * localX +
    Math.sin(bucketAngle) * localY;

  return {
    x: sim.posX + Math.sin(facing) * BOOM_OFFSET + Math.cos(facing) * reach,
    y: height,
    z: sim.posZ + Math.cos(facing) * BOOM_OFFSET - Math.sin(facing) * reach,
  };
}

export function getBucketTipWorld(sim: ExcavatorSimState, boomSwing = 0): BucketTip {
  return bucketPointWorld(sim, boomSwing, -BUCKET_LEN, 0);
}

export function getBoomPivotWorld(sim: ExcavatorSimState, boomSwing = 0): BucketTip {
  const facing = sim.heading + sim.swing + boomSwing * 0.38;
  return {
    x: sim.posX + Math.sin(facing) * BOOM_OFFSET,
    y: BOOM_PIVOT_Y,
    z: sim.posZ + Math.cos(facing) * BOOM_OFFSET,
  };
}

export function getArmPivotWorld(sim: ExcavatorSimState, boomSwing = 0): BucketTip {
  return bucketPointWorld(sim, boomSwing, 0, 0);
}

function linkPointWorld(
  sim: ExcavatorSimState,
  boomSwing: number,
  link: "boom" | "arm",
  t: number,
): BucketTip {
  const facing = sim.heading + sim.swing + boomSwing * 0.38;
  const boomEndX = Math.sin(sim.boom) * BOOM_LEN;
  const boomEndY = Math.cos(sim.boom) * BOOM_LEN;
  const visualArmAngle = sim.boom - sim.arm * VISUAL_ARM_ROTATION_SCALE;
  const along = Math.max(0, Math.min(1, t));

  let reach: number;
  let height: number;
  if (link === "boom") {
    reach = Math.sin(sim.boom) * BOOM_LEN * along;
    height = BOOM_PIVOT_Y + Math.cos(sim.boom) * BOOM_LEN * along;
  } else {
    const armAlong = ARM_LEN * along;
    reach = boomEndX + Math.sin(visualArmAngle) * armAlong;
    height = BOOM_PIVOT_Y + boomEndY + Math.cos(visualArmAngle) * armAlong;
  }

  return {
    x: sim.posX + Math.sin(facing) * BOOM_OFFSET + Math.cos(facing) * reach,
    y: height,
    z: sim.posZ + Math.cos(facing) * BOOM_OFFSET - Math.sin(facing) * reach,
  };
}

/** 붐·암·버킷 vs 덤프트럭 고체 충돌 샘플 */
export function getArmCollisionSamples(sim: ExcavatorSimState, boomSwing = 0): BucketTip[] {
  return [
    getBoomPivotWorld(sim, boomSwing),
    linkPointWorld(sim, boomSwing, "boom", 0.18),
    linkPointWorld(sim, boomSwing, "boom", 0.35),
    linkPointWorld(sim, boomSwing, "boom", 0.55),
    linkPointWorld(sim, boomSwing, "boom", 0.72),
    linkPointWorld(sim, boomSwing, "boom", 0.92),
    getArmPivotWorld(sim, boomSwing),
    linkPointWorld(sim, boomSwing, "arm", 0.2),
    linkPointWorld(sim, boomSwing, "arm", 0.35),
    linkPointWorld(sim, boomSwing, "arm", 0.55),
    linkPointWorld(sim, boomSwing, "arm", 0.72),
    linkPointWorld(sim, boomSwing, "arm", 0.92),
    getBucketBodyContactWorld(sim, boomSwing),
    getBucketScraperContactWorld(sim, boomSwing),
    getBucketTipWorld(sim, boomSwing),
  ];
}

function lowestBucketPoint(
  sim: ExcavatorSimState,
  boomSwing: number,
  samples: readonly (readonly [number, number])[],
) {
  let lowest = bucketPointWorld(sim, boomSwing, samples[0][0], samples[0][1]);
  for (const [localX, localY] of samples.slice(1)) {
    const point = bucketPointWorld(sim, boomSwing, localX, localY);
    if (point.y < lowest.y) lowest = point;
  }
  return lowest;
}

export function getBucketScraperContactWorld(sim: ExcavatorSimState, boomSwing = 0): BucketTip {
  return lowestBucketPoint(sim, boomSwing, [
    [-1.18, -0.54],
    [-0.96, -0.58],
    [-0.82, -0.6],
  ]);
}

export function getBucketBodyContactWorld(sim: ExcavatorSimState, boomSwing = 0): BucketTip {
  return lowestBucketPoint(sim, boomSwing, [
    [-0.68, -0.56],
    [-0.36, -0.48],
    [-0.08, -0.24],
    [0.08, -0.1],
  ]);
}

export function getBucketGroundContactWorld(sim: ExcavatorSimState, boomSwing = 0): BucketTip {
  return getBucketScraperContactWorld(sim, boomSwing);
}

/** 도저 블레이드 하단 월드 좌표 (blade: 0=상승 … 1=하강) */
export function getDozerBladeContactWorld(sim: ExcavatorSimState, blade: number): BucketTip {
  const facing = sim.heading + sim.swing;
  const drop = Math.max(0, Math.min(1, blade)) * YANMAR_MACHINE_RIG.dozerBladeDrop;
  const localBottomY =
    YANMAR_MACHINE_RIG.dozerBladeGroupBaseY -
    drop +
    YANMAR_MACHINE_RIG.dozerBladeMeshLocalY -
    YANMAR_MACHINE_RIG.dozerBladeHalfHeight;
  const reach = YANMAR_MACHINE_RIG.dozerBladeReach;
  return {
    x: sim.posX + Math.sin(facing) * reach,
    y: YANMAR_MACHINE_RIG.excavatorVisualY + localBottomY,
    z: sim.posZ + Math.cos(facing) * reach,
  };
}

/** 지면 기준 블레이드 최대 하강량 (0~1). 땅에 닿으면 그 이상 내려가지 않음. */
export function getMaxDozerBladeFromGround(
  sim: ExcavatorSimState,
  groundY: number,
  clearance = 0.02,
): number {
  const raised = getDozerBladeContactWorld(sim, 0);
  const dropNeeded = raised.y - (groundY + clearance);
  if (dropNeeded <= 0) return 0;
  return Math.max(0, Math.min(1, dropNeeded / YANMAR_MACHINE_RIG.dozerBladeDrop));
}

export interface DigFeedback {
  inDigZone: boolean;
  inDumpZone: boolean;
  tipOnGround: boolean;
  bucketCurled: boolean;
  canLoad: boolean;
  digging: boolean;
  groundDepth: number;
  bucketOpenReady: boolean;
  insertedDeepEnough: boolean;
  bucketCurlReady: boolean;
  armPulling: boolean;
  optimalDigPose: boolean;
  digPoseScore: number;
  /** 현재 자세에서 버킷이 흙을 담을 수 있는 비율 (0~1) */
  soilRetention: number;
  /** 자세 때문에 흙이 쏟아지는 중 */
  soilSpilling: boolean;
  canDump: boolean;
  /** 하역 구역인데 붐·암을 더 들어올려야 함 */
  raiseArmForDump: boolean;
  /** 주행 레버 입력 중 버킷/암이 낮아 이동 불가 */
  travelBlockedRaiseArm: boolean;
  truckPresent: boolean;
  truckCanAccept: boolean;
  truckFillRatio: number;
  truckCooldownRemaining: number;
  digCooldowns: { id: string; label: string; etaSec: number }[];
}

export function createDigFeedback(): DigFeedback {
  return {
    inDigZone: false,
    inDumpZone: false,
    tipOnGround: false,
    bucketCurled: false,
    canLoad: false,
    digging: false,
    groundDepth: 0,
    bucketOpenReady: false,
    insertedDeepEnough: false,
    bucketCurlReady: false,
    armPulling: false,
    optimalDigPose: false,
    digPoseScore: 0,
    soilRetention: 1,
    soilSpilling: false,
    canDump: false,
    raiseArmForDump: false,
    travelBlockedRaiseArm: false,
    truckPresent: true,
    truckCanAccept: true,
    truckFillRatio: 0,
    truckCooldownRemaining: 0,
    digCooldowns: [],
  };
}
