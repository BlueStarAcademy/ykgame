import type { ExcavatorSimState } from "./ExcavatorScene";

const BOOM_LEN = 3;
const ARM_LEN = 2.5;
const BUCKET_LEN = 1.2;
const BOOM_PIVOT_Y = 1.68;
const BOOM_OFFSET = 0.8;
const VISUAL_ARM_ROTATION_SCALE = 1.18;
const VISUAL_BUCKET_ROTATION_SCALE = 1.02;

/** 이 비율 미만이면 적재 불가·급격 유실 */
export const BUCKET_SOIL_HOLD_MIN = 0.16;
/** 유지율: 버킷 말림(curl) × 월드 바가지 자세(cup) */
const SOIL_CURL_FULL = 0.55;
const SOIL_CURL_EMPTY = 1.62;
const SOIL_CUP_CENTER = 1.4;
const SOIL_CUP_HALF_WIDTH = 1.6;

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

/** 붐·암·버킷 월드 자세 기준 흙 유지 가능 비율 (0=전부 유실, 1=만재 유지) */
export function getBucketSoilRetention(boom: number, arm: number, bucket: number): number {
  const visualArmAngle = boom - arm * VISUAL_ARM_ROTATION_SCALE;
  const visualBucketAngle = visualArmAngle - bucket * VISUAL_BUCKET_ROTATION_SCALE;

  // 버킷 관절이 말릴수록 담김 (펴질수록 0)
  const curl = clamp01((SOIL_CURL_EMPTY - bucket) / (SOIL_CURL_EMPTY - SOIL_CURL_FULL));
  // 바가지가 위를 받치는 월드 자세 (너무 펼치거나 뒤집히면 0)
  const cup = clamp01(1 - Math.abs(visualBucketAngle - SOIL_CUP_CENTER) / SOIL_CUP_HALF_WIDTH);

  return clamp01(curl * (0.12 + 0.88 * cup));
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
