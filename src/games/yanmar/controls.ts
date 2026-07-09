/** 얀마 SV08-1 조작 매핑 — YK건기 조작 도면 기준 */

import type { AutoPoseState, SavedArmPose } from "./types";

export const YANMAR_ASSETS = {
  controlsGuide: "/images/yanmar/controls-guide.webp",
} as const;

export const COCKPIT_LAYOUT = {
  width: 1024,
  height: 576,
  left: { cx: 0.095, cy: 0.76, radius: 0.085, travel: 0.05 },
  right: { cx: 0.905, cy: 0.76, radius: 0.085, travel: 0.05 },
  safetyLever: { cx: 0.245, cy: 0.77, radius: 0.038, travel: 0.055 },
  travelLeft: { cx: 0.468, cy: 0.75, radius: 0.043, travel: 0.062 },
  travelRight: { cx: 0.532, cy: 0.75, radius: 0.043, travel: 0.062 },
  travelBoth: { cx: 0.5, cy: 0.75, radius: 0.052, travel: 0.062 },
  hydraulicSpeed: { cx: 0.665, cy: 0.77, radius: 0.038, travel: 0.032 },
  rightPedal: { cx: 0.735, cy: 0.68, width: 0.052, height: 0.62 },
  boomSwing: { cx: 0.34, cy: 0.45, radius: 0.04, travel: 0.045 },
  blade: { cx: 0.63, cy: 0.45, radius: 0.04, travel: 0.045 },
  throttle: { cx: 0.39, cy: 0.45, radius: 0.038, travel: 0.04 },
  horn: { cx: 0.905, cy: 0.2, radius: 0.014 },
} as const;

export interface JoystickInput {
  x: number;
  y: number;
}

export interface TravelInput {
  left: number;
  right: number;
}

export interface ExcavatorControlState {
  left: JoystickInput;
  right: JoystickInput;
  travel: TravelInput;
}

export interface AuxiliaryControlState {
  boomSwing: number;
  blade: number;
  throttle: number;
  highSpeed: boolean;
  safetyLocked: boolean;
}

export interface ControlMask {
  leftX: boolean;
  leftY: boolean;
  rightX: boolean;
  rightY: boolean;
  travel: boolean;
}

export const CONTROL_LABELS = {
  left: {
    xNeg: "스윙 좌",
    xPos: "스윙 우",
    yPos: "암 당김",
    yNeg: "암 뻗음",
  },
  right: {
    yPos: "붐 하강",
    yNeg: "붐 상승",
    xNeg: "버킷 말기",
    xPos: "버킷 펴기",
  },
  travel: {
    forward: "주행 전진",
    backward: "주행 후진",
  },
} as const;

export function filterInput(
  input: ExcavatorControlState,
  mask: ControlMask,
): ExcavatorControlState {
  return {
    left: {
      x: mask.leftX ? input.left.x : 0,
      y: mask.leftY ? input.left.y : 0,
    },
    right: {
      x: mask.rightX ? input.right.x : 0,
      y: mask.rightY ? input.right.y : 0,
    },
    travel: mask.travel ? input.travel : { left: 0, right: 0 },
  };
}

export function createAuxiliaryControls(): AuxiliaryControlState {
  return {
    boomSwing: 0,
    blade: 0,
    throttle: 0,
    highSpeed: false,
    safetyLocked: false,
  };
}

/** 최대 각속도·주행속도 (게임 — 빠른 피드백) */
export const CONTROL_SPEED = {
  swing: 1.4,
  travel: 5.5,
  trackTurn: 1.35,
  boom: 1.35,
  arm: 0.85,
  bucket: 1.2,
} as const;

/** 탑승 체험 — 실제 미니 굴착기에 가까운 저속 프로필 */
export const RIDE_CONTROL_SPEED = {
  swing: 0.52,
  travel: 2.1,
  trackTurn: 0.5,
  boom: 0.48,
  arm: 0.3,
  bucket: 0.42,
} as const;

export type ControlSpeedProfile = typeof CONTROL_SPEED | typeof RIDE_CONTROL_SPEED;

/** 버킷 말기(우 조이스틱 좌) 시 각속도 — 펴기보다 완만하게 */
const BUCKET_CURL_SPEED_SCALE = 0.72;

/** 유압 가속 (입력 시) */
const ACCEL = {
  swing: 5.5,
  travel: 7,
  boom: 6.5,
  arm: 4,
  bucket: 5,
} as const;

/** 유압 감쇠 (입력 해제 시) */
const DAMPING = {
  swing: 3.2,
  travel: 4.5,
  boom: 3,
  arm: 2.8,
  bucket: 3.2,
} as const;

export const JOINT_LIMITS = {
  boom: { min: 0.06, max: 1.45 },
  arm: { min: -2.05, max: 0.55 },
  bucket: { min: 0.35, max: 3.6 },
} as const;

export interface HydraulicVelocity {
  swing: number;
  boom: number;
  arm: number;
  bucket: number;
  travel: number;
  trackTurn: number;
}

export function createHydraulicVelocity(): HydraulicVelocity {
  return { swing: 0, boom: 0, arm: 0, bucket: 0, travel: 0, trackTurn: 0 };
}

function approach(current: number, target: number, accel: number, damp: number, dt: number) {
  if (Math.abs(target) > 0.02) {
    const delta = target - current;
    return current + delta * Math.min(1, accel * dt);
  }
  return current * Math.exp(-damp * dt);
}

function pickStrongerAxis(a: number, b: number) {
  return Math.abs(a) >= Math.abs(b) ? a : b;
}

/** 터치·키보드 입력을 축별로 병합 (큰 입력값 우선) */
export function mergeControlInputs(
  touch: ExcavatorControlState,
  keyboard: ExcavatorControlState,
): ExcavatorControlState {
  return {
    left: {
      x: pickStrongerAxis(touch.left.x, keyboard.left.x),
      y: pickStrongerAxis(touch.left.y, keyboard.left.y),
    },
    right: {
      x: pickStrongerAxis(touch.right.x, keyboard.right.x),
      y: pickStrongerAxis(touch.right.y, keyboard.right.y),
    },
    travel: {
      left: pickStrongerAxis(touch.travel.left, keyboard.travel.left),
      right: pickStrongerAxis(touch.travel.right, keyboard.travel.right),
    },
  };
}

export function applyControls(
  state: {
    swing: number;
    boom: number;
    arm: number;
    bucket: number;
    posX: number;
    posZ: number;
    heading: number;
  },
  input: ExcavatorControlState,
  dt: number,
  vel: HydraulicVelocity,
  hydraulicSpeedScale = 1,
  travelSpeedScale = 1,
  speedProfile: ControlSpeedProfile = CONTROL_SPEED,
) {
  const { left, right, travel } = input;

  vel.swing = approach(
    vel.swing,
    -left.x * speedProfile.swing,
    ACCEL.swing,
    DAMPING.swing,
    dt,
  );
  vel.arm = approach(
    vel.arm,
    -left.y * speedProfile.arm * hydraulicSpeedScale,
    ACCEL.arm,
    DAMPING.arm,
    dt,
  );
  const leftTrack = travel.right;
  const rightTrack = travel.left;
  const trackAverage = (leftTrack + rightTrack) / 2;
  const trackDelta = leftTrack - rightTrack;

  vel.travel = approach(
    vel.travel,
    trackAverage * speedProfile.travel * travelSpeedScale,
    ACCEL.travel,
    DAMPING.travel,
    dt,
  );
  vel.trackTurn = approach(
    vel.trackTurn,
    trackDelta * speedProfile.trackTurn,
    ACCEL.travel,
    DAMPING.travel,
    dt,
  );
  // 우 조이스틱 앞=붐 하강(각도↑·버킷↓), 뒤=붐 상승 — 3D 암 골격과 일치
  vel.boom = approach(
    vel.boom,
    right.y * speedProfile.boom * hydraulicSpeedScale,
    ACCEL.boom,
    DAMPING.boom,
    dt,
  );
  vel.bucket = approach(
    vel.bucket,
    right.x *
      speedProfile.bucket *
      hydraulicSpeedScale *
      (right.x < 0 ? BUCKET_CURL_SPEED_SCALE : 1),
    ACCEL.bucket,
    DAMPING.bucket,
    dt,
  );

  state.swing += vel.swing * dt;
  state.heading += vel.trackTurn * dt;

  const nextArm = state.arm + vel.arm * dt;
  if (nextArm < JOINT_LIMITS.arm.min) vel.arm = Math.max(0, vel.arm);
  if (nextArm > JOINT_LIMITS.arm.max) vel.arm = Math.min(0, vel.arm);
  state.arm = clamp(nextArm, JOINT_LIMITS.arm.min, JOINT_LIMITS.arm.max);

  const move = vel.travel * dt;
  state.posX += Math.sin(state.heading + state.swing) * move;
  state.posZ += Math.cos(state.heading + state.swing) * move;

  const nextBoom = state.boom + vel.boom * dt;
  if (nextBoom < JOINT_LIMITS.boom.min) vel.boom = Math.max(0, vel.boom);
  if (nextBoom > JOINT_LIMITS.boom.max) vel.boom = Math.min(0, vel.boom);
  state.boom = clamp(nextBoom, JOINT_LIMITS.boom.min, JOINT_LIMITS.boom.max);

  const nextBucket = state.bucket + vel.bucket * dt;
  if (nextBucket < JOINT_LIMITS.bucket.min) vel.bucket = Math.max(0, vel.bucket);
  if (nextBucket > JOINT_LIMITS.bucket.max) vel.bucket = Math.min(0, vel.bucket);
  state.bucket = clamp(nextBucket, JOINT_LIMITS.bucket.min, JOINT_LIMITS.bucket.max);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function canLoadBucket(boom: number, bucket: number) {
  return boom > 0.2 && bucket <= 1.1;
}

export function canDumpBucket(bucket: number) {
  return bucket > 0.25;
}

export const AUTO_ARM_POSE_ARRIVE_EPS = 0.012;

export function createAutoPoseState(): AutoPoseState {
  return { saved: null, executing: false };
}

function autoStickToward(current: number, goal: number) {
  const delta = goal - current;
  if (Math.abs(delta) <= AUTO_ARM_POSE_ARRIVE_EPS) return 0;
  return Math.sign(delta);
}

function isAutoPoseJointSettled(current: number, goal: number) {
  return Math.abs(current - goal) <= AUTO_ARM_POSE_ARRIVE_EPS;
}

/** 적재 자세 그래프와 같이 암 → 붐 → 버킷 순으로 한 축씩만 이동한다. */
export function getActiveAutoPoseJoint(
  sim: { boom: number; arm: number; bucket: number },
  saved: SavedArmPose,
): "arm" | "boom" | "bucket" | null {
  if (!isAutoPoseJointSettled(sim.arm, saved.arm)) return "arm";
  if (!isAutoPoseJointSettled(sim.boom, saved.boom)) return "boom";
  if (!isAutoPoseJointSettled(sim.bucket, saved.bucket)) return "bucket";
  return null;
}

/** 저장 자세까지 수동 조이스틱과 동일한 축 입력을 합성한다. */
export function buildAutoArmControlInput(
  sim: { boom: number; arm: number; bucket: number },
  saved: SavedArmPose,
): Pick<ExcavatorControlState, "left" | "right"> {
  const idle = {
    left: { x: 0, y: 0 },
    right: { x: 0, y: 0 },
  } as const;

  switch (getActiveAutoPoseJoint(sim, saved)) {
    case "arm":
      return {
        ...idle,
        left: { x: 0, y: -autoStickToward(sim.arm, saved.arm) },
      };
    case "boom":
      return {
        ...idle,
        right: { x: 0, y: autoStickToward(sim.boom, saved.boom) },
      };
    case "bucket":
      return {
        ...idle,
        right: { x: autoStickToward(sim.bucket, saved.bucket), y: 0 },
      };
    default:
      return idle;
  }
}

/** 자동 실행 중 굴착 구역에서 순차 이동·저장 자세 도달 시 흙 적재를 허용한다. */
export function isAutoPoseDigLoadingActive(
  sim: { boom: number; arm: number; bucket: number },
  saved: SavedArmPose,
  env: {
    inZone: boolean;
    bucketInWorkRange: boolean;
    scrapeMotion: number;
  },
): boolean {
  if (!env.inZone || !env.bucketInWorkRange || env.scrapeMotion < 0.01) {
    return false;
  }

  const activeJoint = getActiveAutoPoseJoint(sim, saved);
  if (activeJoint !== null) return true;

  return (
    isAutoPoseJointSettled(sim.arm, saved.arm) &&
    isAutoPoseJointSettled(sim.boom, saved.boom) &&
    isAutoPoseJointSettled(sim.bucket, saved.bucket)
  );
}

export function getAutoDigPoseReadiness(
  sim: { boom: number; arm: number; bucket: number },
  saved: SavedArmPose,
  insertedDeepEnough: boolean,
  bucketOpenReady: boolean,
): number {
  const activeJoint = getActiveAutoPoseJoint(sim, saved);
  let score = 0;
  if (bucketOpenReady) score += 1;
  if (insertedDeepEnough) score += 1;
  if (activeJoint === "bucket" || isAutoPoseJointSettled(sim.bucket, saved.bucket)) {
    score += 1;
  }
  if (activeJoint === "arm" || isAutoPoseJointSettled(sim.arm, saved.arm)) {
    score += 1;
  }
  return score / 4;
}

export function finishAutoArmPoseIfComplete(
  sim: { boom: number; arm: number; bucket: number },
  vel: HydraulicVelocity,
  autoPose: AutoPoseState,
) {
  if (!autoPose.executing || !autoPose.saved) return;

  const target = autoPose.saved;
  const settled = (["arm", "boom", "bucket"] as const).every((key) =>
    isAutoPoseJointSettled(sim[key], target[key]),
  );
  if (!settled) return;

  sim.boom = target.boom;
  sim.arm = target.arm;
  sim.bucket = target.bucket;
  vel.boom = 0;
  vel.arm = 0;
  vel.bucket = 0;
  autoPose.executing = false;
}

const MANUAL_INPUT_THRESHOLD = 0.08;

export function hasManualControlInput(
  input: ExcavatorControlState,
  allowed: ControlMask,
  auxiliary?: AuxiliaryControlState,
) {
  if (allowed.leftX && Math.abs(input.left.x) > MANUAL_INPUT_THRESHOLD) return true;
  if (allowed.leftY && Math.abs(input.left.y) > MANUAL_INPUT_THRESHOLD) return true;
  if (allowed.rightX && Math.abs(input.right.x) > MANUAL_INPUT_THRESHOLD) return true;
  if (allowed.rightY && Math.abs(input.right.y) > MANUAL_INPUT_THRESHOLD) return true;
  if (
    allowed.travel &&
    (Math.abs(input.travel.left) > MANUAL_INPUT_THRESHOLD ||
      Math.abs(input.travel.right) > MANUAL_INPUT_THRESHOLD)
  ) {
    return true;
  }
  if (auxiliary && Math.abs(auxiliary.boomSwing) > MANUAL_INPUT_THRESHOLD) return true;
  return false;
}

export function cancelAutoArmPose(autoPose: AutoPoseState) {
  autoPose.executing = false;
}

export const ALL_CONTROLS: ControlMask = {
  leftX: true,
  leftY: true,
  rightX: true,
  rightY: true,
  travel: true,
};

export const LOCKED_CONTROLS: ControlMask = {
  leftX: false,
  leftY: false,
  rightX: false,
  rightY: false,
  travel: false,
};
