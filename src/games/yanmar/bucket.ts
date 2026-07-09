import type { ExcavatorSimState } from "./ExcavatorScene";

const BOOM_LEN = 3;
const ARM_LEN = 2.5;
const BUCKET_LEN = 1.2;
const BOOM_PIVOT_Y = 1.68;
const BOOM_OFFSET = 0.8;
const VISUAL_ARM_ROTATION_SCALE = 1.18;
const VISUAL_BUCKET_ROTATION_SCALE = 1.02;

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
  canDump: boolean;
  /** 하역 구역인데 붐·암을 더 들어올려야 함 */
  raiseArmForDump: boolean;
  /** 주행 레버 입력 중 버킷/암이 낮아 이동 불가 */
  travelBlockedRaiseArm: boolean;
  truckPresent: boolean;
  truckCanAccept: boolean;
  truckFillRatio: number;
  truckCooldownRemaining: number;
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
    canDump: false,
    raiseArmForDump: false,
    travelBlockedRaiseArm: false,
    truckPresent: true,
    truckCanAccept: true,
    truckFillRatio: 0,
    truckCooldownRemaining: 0,
  };
}
