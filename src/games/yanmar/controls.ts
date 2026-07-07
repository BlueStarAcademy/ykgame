/** 얀마 SV08-1 조작 매핑 — YK건기 조작 도면 기준 */

export const YANMAR_ASSETS = {
  cockpit: "/images/yanmar/cockpit-game-controls.png",
  cockpitFallback: "/images/yanmar/cockpit.svg",
  controlsGuide: "/images/yanmar/controls-guide.webp",
} as const;

export const COCKPIT_LAYOUT = {
  width: 1024,
  height: 576,
  left: { cx: 0.205, cy: 0.17, radius: 0.085, travel: 0.05 },
  right: { cx: 0.795, cy: 0.17, radius: 0.085, travel: 0.05 },
  travelLeft: { cx: 0.485, cy: 0.205, radius: 0.043, travel: 0.068 },
  travelRight: { cx: 0.528, cy: 0.205, radius: 0.043, travel: 0.068 },
  travelBoth: { cx: 0.5065, cy: 0.205, radius: 0.052, travel: 0.068 },
  boomSwing: { cx: 0.395, cy: 0.25, radius: 0.04, travel: 0.045 },
  blade: { cx: 0.625, cy: 0.25, radius: 0.04, travel: 0.045 },
  throttle: { cx: 0.415, cy: 0.18, radius: 0.038, travel: 0.04 },
  horn: { cx: 0.818, cy: 0.085, radius: 0.014 },
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
  trackWidth: number;
  blade: number;
  throttle: number;
  workLight: boolean;
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
    yPos: "암 뻗음",
    yNeg: "암 당김",
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
    trackWidth: 0,
    blade: 0,
    throttle: 0,
    workLight: false,
    highSpeed: false,
    safetyLocked: false,
  };
}

/** 최대 각속도·주행속도 */
export const CONTROL_SPEED = {
  swing: 1.4,
  travel: 5.5,
  trackTurn: 1.35,
  boom: 1.35,
  arm: 0.85,
  bucket: 1.2,
} as const;

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
  swing: { min: -Math.PI, max: Math.PI },
  boom: { min: -0.15, max: 1.45 },
  arm: { min: -1.5, max: 0.55 },
  bucket: { min: -1.8, max: 0.8 },
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
  if (Math.abs(target) > 0.05) {
    const delta = target - current;
    return current + delta * Math.min(1, accel * dt);
  }
  return current * Math.exp(-damp * dt);
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
) {
  const { left, right, travel } = input;

  vel.swing = approach(
    vel.swing,
    -left.x * CONTROL_SPEED.swing,
    ACCEL.swing,
    DAMPING.swing,
    dt,
  );
  vel.arm = approach(vel.arm, -left.y * CONTROL_SPEED.arm, ACCEL.arm, DAMPING.arm, dt);
  const leftTrack = travel.left;
  const rightTrack = travel.right;
  const trackAverage = (leftTrack + rightTrack) / 2;
  const trackDelta = rightTrack - leftTrack;

  vel.travel = approach(
    vel.travel,
    trackAverage * CONTROL_SPEED.travel,
    ACCEL.travel,
    DAMPING.travel,
    dt,
  );
  vel.trackTurn = approach(
    vel.trackTurn,
    trackDelta * CONTROL_SPEED.trackTurn,
    ACCEL.travel,
    DAMPING.travel,
    dt,
  );
  // 우 조이스틱 앞=붐 하강(각도↑·버킷↓), 뒤=붐 상승 — 3D 암 골격과 일치
  vel.boom = approach(
    vel.boom,
    right.y * CONTROL_SPEED.boom,
    ACCEL.boom,
    DAMPING.boom,
    dt,
  );
  vel.bucket = approach(
    vel.bucket,
    -right.x * CONTROL_SPEED.bucket,
    ACCEL.bucket,
    DAMPING.bucket,
    dt,
  );

  state.swing += vel.swing * dt;
  state.swing = clamp(state.swing, JOINT_LIMITS.swing.min, JOINT_LIMITS.swing.max);
  state.heading += vel.trackTurn * dt;

  state.arm += vel.arm * dt;
  state.arm = clamp(state.arm, JOINT_LIMITS.arm.min, JOINT_LIMITS.arm.max);

  const move = vel.travel * dt;
  state.posX += Math.sin(state.heading + state.swing) * move;
  state.posZ += Math.cos(state.heading + state.swing) * move;

  state.boom += vel.boom * dt;
  state.boom = clamp(state.boom, JOINT_LIMITS.boom.min, JOINT_LIMITS.boom.max);

  state.bucket += vel.bucket * dt;
  state.bucket = clamp(state.bucket, JOINT_LIMITS.bucket.min, JOINT_LIMITS.bucket.max);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function canLoadBucket(boom: number, bucket: number) {
  return boom > 0.55 && bucket < -0.25;
}

export function canDumpBucket(bucket: number) {
  return bucket > 0.25;
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
