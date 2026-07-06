/** 얀마 SV08-1 조작 매핑 — YK건기 조작 도면 기준 */

export const YANMAR_ASSETS = {
  cockpit: "/images/yanmar/cockpit.png",
  cockpitFallback: "/images/yanmar/cockpit.svg",
  controlsGuide: "/images/yanmar/controls-guide.png",
} as const;

/**
 * cockpit.png 1024×682 핫스팟 (0~1)
 * ① 좌 조이스틱: 좌우=스윙, 전후=암
 * ② 주행 레버: 전후=전진/후진
 * ⑤ 우 조이스틱: 전후=붐, 좌우=버킷
 */
export const COCKPIT_LAYOUT = {
  width: 1024,
  height: 682,
  left: { cx: 0.378, cy: 0.44, radius: 0.085 },
  right: { cx: 0.622, cy: 0.44, radius: 0.085 },
  travel: { cx: 0.5, cy: 0.28, radius: 0.065 },
  knobTravel: 0.038,
} as const;

export interface JoystickInput {
  x: number;
  y: number;
}

export interface ExcavatorControlState {
  left: JoystickInput;
  right: JoystickInput;
  /** ② 주행 레버: +1 전진, -1 후진 */
  travel: number;
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
    travel: mask.travel ? input.travel : 0,
  };
}

export const CONTROL_SPEED = {
  swing: 1.2,
  travel: 4,
  boom: 0.8,
  arm: 0.65,
  bucket: 1.0,
} as const;

export const JOINT_LIMITS = {
  swing: { min: -Math.PI, max: Math.PI },
  boom: { min: -0.3, max: 1.2 },
  arm: { min: -1.5, max: 0.5 },
  bucket: { min: -1.8, max: 0.8 },
} as const;

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
) {
  const { left, right, travel } = input;

  // ① 좌: 좌우=스윙, 전후=암
  state.swing += left.x * CONTROL_SPEED.swing * dt;
  state.swing = clamp(state.swing, JOINT_LIMITS.swing.min, JOINT_LIMITS.swing.max);

  state.arm += left.y * CONTROL_SPEED.arm * dt;
  state.arm = clamp(state.arm, JOINT_LIMITS.arm.min, JOINT_LIMITS.arm.max);

  // ② 주행 레버
  const move = travel * CONTROL_SPEED.travel * dt;
  state.posX += Math.sin(state.heading + state.swing) * move;
  state.posZ += Math.cos(state.heading + state.swing) * move;

  // ⑤ 우: 전후=붐(앞=하강, 뒤=상승), 좌우=버킷
  state.boom -= right.y * CONTROL_SPEED.boom * dt;
  state.boom = clamp(state.boom, JOINT_LIMITS.boom.min, JOINT_LIMITS.boom.max);

  state.bucket += right.x * CONTROL_SPEED.bucket * dt;
  state.bucket = clamp(state.bucket, JOINT_LIMITS.bucket.min, JOINT_LIMITS.bucket.max);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function canLoadBucket(boom: number, bucket: number) {
  return boom > 0.3 && bucket < -0.5;
}

export function canDumpBucket(bucket: number) {
  return bucket > 0.3;
}

export const ALL_CONTROLS: ControlMask = {
  leftX: true,
  leftY: true,
  rightX: true,
  rightY: true,
  travel: true,
};
