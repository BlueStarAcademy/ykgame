/** 얀마 SV08-1 조작 매핑 — YK건기 조작 도면 기준 */

import type { AutoPoseState } from "./types";

export const YANMAR_ASSETS = {
  controlsGuide: "/images/yanmar/controls-guide.webp",
} as const;

export const COCKPIT_LAYOUT = {
  width: 1024,
  height: 576,
  left: { cx: 0.095, cy: 0.76, radius: 0.085, travel: 0.05 },
  right: { cx: 0.905, cy: 0.76, radius: 0.085, travel: 0.05 },
  safetyLever: { cx: 0.245, cy: 0.77, radius: 0.038, travel: 0.055 },
  travelLeft: { cx: 0.473, cy: 0.75, radius: 0.043, travel: 0.062 },
  travelRight: { cx: 0.532, cy: 0.75, radius: 0.043, travel: 0.062 },
  travelBoth: { cx: 0.5, cy: 0.75, radius: 0.052, travel: 0.062 },
  hydraulicSpeed: { cx: 0.665, cy: 0.77, radius: 0.038, travel: 0.032 },
  rightPedal: { cx: 0.735, cy: 0.68, width: 0.052, height: 0.62 },
  /** 좌측 패드와 주행 레버 사이 — 브레이커·집게 양방향 발판 */
  breakerPedal: { cx: 0.28, cy: 0.76, width: 0.048, height: 0.28 },
  boomSwing: { cx: 0.34, cy: 0.45, radius: 0.04, travel: 0.045 },
  /** 우측 조이스틱과 우측 주행 레버 사이 */
  blade: { cx: 0.72, cy: 0.76, radius: 0.038, travel: 0.055 },
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
  /** 위=1, 아래=-1. 브레이커는 양쪽 모두 타격, 집게는 위 닫기·아래 열기. */
  attachmentPedal: -1 | 0 | 1;
  /** 0=닫힘, 1=완전히 열림. */
  grappleOpen: number;
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
    yPos: "암 뻗음",
    yNeg: "암 당김",
  },
  right: {
    yPos: "붐 하강",
    yNeg: "붐 상승",
    xNeg: "버켓 말기",
    xPos: "버켓 펴기",
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

/** 카메라3(1인칭) 기준: 암을 약간 오른쪽에서 중앙 쪽으로 기울인 기본 자세 */
export const DEFAULT_BOOM_SWING = 0.28;

/** 블레이드: 0=상승(기본), 1=하강(접지) */
export const BLADE_RAISED = 0;
export const BLADE_LOWERED = 1;
/** 레버를 끝까지 밀었을 때 최저↔최고 이동에 2초 */
export const BLADE_SPEED_PER_SECOND = 0.5;

export function createAuxiliaryControls(): AuxiliaryControlState {
  return {
    boomSwing: DEFAULT_BOOM_SWING,
    blade: 0,
    throttle: 0,
    highSpeed: false,
    safetyLocked: false,
    attachmentPedal: 0,
    grappleOpen: 1,
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
  /** Left track linear speed (model -Z). */
  trackLeft: number;
  /** Right track linear speed (model +Z). */
  trackRight: number;
}

export function createHydraulicVelocity(): HydraulicVelocity {
  return {
    swing: 0,
    boom: 0,
    arm: 0,
    bucket: 0,
    travel: 0,
    trackTurn: 0,
    trackLeft: 0,
    trackRight: 0,
  };
}

/**
 * Physics track stance for yaw. Sized so one-lever pivots rotate about the
 * stopped track at a playable rate (≈ legacy trackTurn) without launching.
 */
const TRACK_WIDTH_PHYSICS = 4;

/** 직진 주행 시 하부가 상체 방향으로 따라오는 정렬 속도. */
const DRIVE_CHASSIS_ALIGN_MAX_SPEED = 0.9;
const DRIVE_CHASSIS_ALIGN_RESPONSE = 1.8;
const DRIVE_CHASSIS_ALIGN_INPUT_THRESHOLD = 0.1;
const DRIVE_CHASSIS_ALIGN_EPSILON = 0.006;

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
  // 좌 조이스틱 앞=암 뻗음(각도↑), 뒤=암 당김 — 위/아래 매핑 반전 반영
  vel.arm = approach(
    vel.arm,
    left.y * speedProfile.arm * hydraulicSpeedScale,
    ACCEL.arm,
    DAMPING.arm,
    dt,
  );

  // Independent track drives: one lever moves only that track (pivot on the other).
  const trackSpeedMax = speedProfile.travel * travelSpeedScale;
  vel.trackLeft = approach(
    vel.trackLeft,
    travel.left * trackSpeedMax,
    ACCEL.travel,
    DAMPING.travel,
    dt,
  );
  vel.trackRight = approach(
    vel.trackRight,
    travel.right * trackSpeedMax,
    ACCEL.travel,
    DAMPING.travel,
    dt,
  );
  vel.travel = (vel.trackLeft + vel.trackRight) / 2;
  // Positive heading = CCW; left-forward/right-stop turns right (CW) → negative ω.
  // Use physics width so one-sided drive pivots on the stopped track without
  // an extreme yaw rate that launches the body over terrain samples.
  vel.trackTurn = (vel.trackRight - vel.trackLeft) / TRACK_WIDTH_PHYSICS;

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

  // Integrate travel on an arc around the instantaneous center of rotation so a
  // stopped track stays planted (in-place circle) instead of slip-translating.
  // 주행은 하부 차체 방향만 따른다. 상체 스윙은 궤도 진행 방향에 영향을 주지 않는다.
  const facing = state.heading;
  const driveCommand = (travel.left + travel.right) / 2;
  const straightDriveRequested =
    Math.abs(driveCommand) > DRIVE_CHASSIS_ALIGN_INPUT_THRESHOLD &&
    travel.left * travel.right > 0 &&
    Math.abs(travel.left - travel.right) < 0.15;

  // 직진 주행으로 하부 정렬 중에는 잔여 스윙 속도가 다시 어긋남을 만들지 않게 한다.
  if (straightDriveRequested && Math.abs(normalizeAngle(state.swing)) > DRIVE_CHASSIS_ALIGN_EPSILON) {
    vel.swing = 0;
  } else {
    state.swing += vel.swing * dt;
  }

  const nextArm = state.arm + vel.arm * dt;
  if (nextArm < JOINT_LIMITS.arm.min) vel.arm = Math.max(0, vel.arm);
  if (nextArm > JOINT_LIMITS.arm.max) vel.arm = Math.min(0, vel.arm);
  state.arm = clamp(nextArm, JOINT_LIMITS.arm.min, JOINT_LIMITS.arm.max);

  let speed = vel.travel;
  let omega = vel.trackTurn;
  let chassisAlignmentDelta = 0;
  if (straightDriveRequested) {
    const alignmentError = normalizeAngle(state.swing);
    state.swing = alignmentError;
    if (Math.abs(alignmentError) <= DRIVE_CHASSIS_ALIGN_EPSILON) {
      state.swing = 0;
    } else {
      const alignmentSpeed =
        Math.min(
          DRIVE_CHASSIS_ALIGN_MAX_SPEED,
          Math.abs(alignmentError) * DRIVE_CHASSIS_ALIGN_RESPONSE,
        ) * Math.min(1, Math.abs(driveCommand));
      chassisAlignmentDelta =
        Math.sign(alignmentError) *
        Math.min(Math.abs(alignmentError), alignmentSpeed * dt);

      // 전진·후진을 유지한 채 하부를 상체 쪽으로 돌려 곡선으로 정렬한다.
      omega += dt > 0 ? chassisAlignmentDelta / dt : 0;
      vel.trackTurn = omega;
    }
  }
  if (Math.abs(omega) > 1e-4) {
    const radius = speed / omega;
    const rightX = Math.cos(facing);
    const rightZ = -Math.sin(facing);
    const iccX = state.posX - radius * rightX;
    const iccZ = state.posZ - radius * rightZ;
    const dTheta = omega * dt;
    const cos = Math.cos(dTheta);
    const sin = Math.sin(dTheta);
    const relX = state.posX - iccX;
    const relZ = state.posZ - iccZ;
    state.posX = iccX + relX * cos - relZ * sin;
    state.posZ = iccZ + relX * sin + relZ * cos;
    state.heading += dTheta;
  } else {
    const move = speed * dt;
    state.posX += Math.sin(facing) * move;
    state.posZ += Math.cos(facing) * move;
  }
  // 하부가 따라 회전한 만큼 상체 상대각을 줄여 상체의 세계 방향은 유지한다.
  state.swing -= chassisAlignmentDelta;
  if (Math.abs(state.swing) <= DRIVE_CHASSIS_ALIGN_EPSILON) {
    state.swing = 0;
  }

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

function normalizeAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function canLoadBucket(boom: number, bucket: number) {
  return boom > 0.2 && bucket <= 1.1;
}

export function canDumpBucket(bucket: number) {
  return bucket > 0.25;
}

export const AUTO_ARM_POSE_ARRIVE_EPS = 0.012;

/** 암 → 붐 → 버킷 고정 순서 */
export const AUTO_POSE_JOINT_ORDER = ["arm", "boom", "bucket"] as const;

export function createAutoPoseState(): AutoPoseState {
  return {
    slots: [null, null],
    activeSlot: 0,
    saved: null,
    executing: false,
    phase: null,
  };
}

function autoStickToward(current: number, goal: number) {
  const delta = goal - current;
  if (Math.abs(delta) <= AUTO_ARM_POSE_ARRIVE_EPS) return 0;
  return Math.sign(delta);
}

function isAutoPoseJointSettled(current: number, goal: number) {
  return Math.abs(current - goal) <= AUTO_ARM_POSE_ARRIVE_EPS;
}

function holdAutoPoseJoint(
  sim: { boom: number; arm: number; bucket: number },
  vel: HydraulicVelocity,
  joint: (typeof AUTO_POSE_JOINT_ORDER)[number],
  target: number,
) {
  sim[joint] = target;
  vel[joint] = 0;
}

/** 적재 자세처럼 암 → 붐 → 버킷 순으로 한 축씩만 이동한다. */
export function getActiveAutoPoseJoint(
  autoPose: AutoPoseState,
): (typeof AUTO_POSE_JOINT_ORDER)[number] | null {
  if (!autoPose.executing || autoPose.saved == null || autoPose.phase == null) {
    return null;
  }
  return AUTO_POSE_JOINT_ORDER[autoPose.phase] ?? null;
}

/**
 * 저장 자세까지 수동 조이스틱과 동일한 축 입력을 합성한다.
 * applyControls 부호: 암 +left.y, 붐 +right.y, 버킷 +right.x
 */
export function buildAutoArmControlInput(
  sim: { boom: number; arm: number; bucket: number },
  autoPose: AutoPoseState,
): Pick<ExcavatorControlState, "left" | "right"> {
  const idle = {
    left: { x: 0, y: 0 },
    right: { x: 0, y: 0 },
  } as const;
  const saved = autoPose.saved;
  if (!saved) return idle;

  switch (getActiveAutoPoseJoint(autoPose)) {
    case "arm":
      // left.y > 0 = 암 뻗음(각도↑), applyControls에서 vel.arm = +left.y
      return {
        ...idle,
        left: { x: 0, y: autoStickToward(sim.arm, saved.arm) },
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

/** 완료된 축은 잠그고, 현재 phase 관절이 목표에 닿으면 다음 축으로 넘긴다. */
export function advanceAutoArmPose(
  sim: { boom: number; arm: number; bucket: number },
  vel: HydraulicVelocity,
  autoPose: AutoPoseState,
) {
  if (!autoPose.executing || !autoPose.saved || autoPose.phase == null) return;

  const target = autoPose.saved;

  while (autoPose.phase != null) {
    const phase = autoPose.phase;

    for (let i = 0; i < phase; i += 1) {
      const joint = AUTO_POSE_JOINT_ORDER[i];
      holdAutoPoseJoint(sim, vel, joint, target[joint]);
    }

    const active = AUTO_POSE_JOINT_ORDER[phase];
    if (!isAutoPoseJointSettled(sim[active], target[active])) return;

    holdAutoPoseJoint(sim, vel, active, target[active]);

    if (phase < 2) {
      autoPose.phase = (phase + 1) as 1 | 2;
      continue;
    }

    holdAutoPoseJoint(sim, vel, "arm", target.arm);
    holdAutoPoseJoint(sim, vel, "boom", target.boom);
    holdAutoPoseJoint(sim, vel, "bucket", target.bucket);
    autoPose.executing = false;
    autoPose.phase = null;
    return;
  }
}

/** 자동 실행 중 굴착 구역에서 순차 이동·저장 자세 도달 시 흙 적재를 허용한다. */
export function isAutoPoseDigLoadingActive(
  sim: { boom: number; arm: number; bucket: number },
  autoPose: AutoPoseState,
  env: {
    inZone: boolean;
    bucketInWorkRange: boolean;
    scrapeMotion: number;
  },
): boolean {
  if (!env.inZone || !env.bucketInWorkRange || env.scrapeMotion < 0.01) {
    return false;
  }
  if (!autoPose.executing || !autoPose.saved) return false;

  const activeJoint = getActiveAutoPoseJoint(autoPose);
  if (activeJoint !== null) return true;

  const saved = autoPose.saved;
  return (
    isAutoPoseJointSettled(sim.arm, saved.arm) &&
    isAutoPoseJointSettled(sim.boom, saved.boom) &&
    isAutoPoseJointSettled(sim.bucket, saved.bucket)
  );
}

export function getAutoDigPoseReadiness(
  sim: { boom: number; arm: number; bucket: number },
  autoPose: AutoPoseState,
  insertedDeepEnough: boolean,
  bucketOpenReady: boolean,
): number {
  const saved = autoPose.saved;
  if (!saved) return 0;

  const activeJoint = getActiveAutoPoseJoint(autoPose);
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

const MANUAL_INPUT_THRESHOLD = 0.08;

/**
 * 암·붐·버켓(좌·우 조이스틱) 수동 입력만 감지한다.
 * 주행 레버는 자동 자세 실행 중에도 허용하므로 여기서 제외한다.
 */
export function hasManualControlInput(
  input: ExcavatorControlState,
  allowed: ControlMask,
  _auxiliary?: AuxiliaryControlState,
) {
  if (allowed.leftX && Math.abs(input.left.x) > MANUAL_INPUT_THRESHOLD) return true;
  if (allowed.leftY && Math.abs(input.left.y) > MANUAL_INPUT_THRESHOLD) return true;
  if (allowed.rightX && Math.abs(input.right.x) > MANUAL_INPUT_THRESHOLD) return true;
  if (allowed.rightY && Math.abs(input.right.y) > MANUAL_INPUT_THRESHOLD) return true;
  return false;
}

export function startAutoArmPose(
  autoPose: AutoPoseState,
  slot: 0 | 1 = autoPose.activeSlot,
) {
  const pose = autoPose.slots[slot];
  if (!pose) return false;
  autoPose.activeSlot = slot;
  autoPose.saved = { ...pose };
  autoPose.executing = true;
  autoPose.phase = 0;
  return true;
}

export function cancelAutoArmPose(autoPose: AutoPoseState) {
  autoPose.executing = false;
  autoPose.phase = null;
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
