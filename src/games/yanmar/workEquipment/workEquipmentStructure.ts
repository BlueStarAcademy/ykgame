import {
  getBoomRaiseMinJoint,
  YANMAR_MACHINE_RIG,
} from "../machineVisualTheme";

const BOOM_LEN = YANMAR_MACHINE_RIG.boomLength;
const ARM_LEN = YANMAR_MACHINE_RIG.armLength;

export type Vec2 = { x: number; y: number };

function hypot(dx: number, dy: number) {
  return Math.hypot(dx, dy);
}

function rotate(p: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: c * p.x - s * p.y, y: s * p.x + c * p.y };
}

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

/** Gooseneck kink in boom-local (kinematic foot→tip axis kept). */
export function getGooseneckKink(boomLen: number = BOOM_LEN): Vec2 {
  return {
    x: boomLen * YANMAR_MACHINE_RIG.boomGooseneckKinkAlong,
    y: Math.min(
      YANMAR_MACHINE_RIG.boomGooseneckKinkRiseCap,
      boomLen * YANMAR_MACHINE_RIG.boomGooseneckKinkRise,
    ),
  };
}

export function getGooseneckGeometry(boomLen: number = BOOM_LEN) {
  const kink = getGooseneckKink(boomLen);
  const lowerLen = hypot(kink.x, kink.y) || 1;
  const upperDx = boomLen - kink.x;
  const upperDy = -kink.y;
  const upperLen = hypot(upperDx, upperDy) || 1;
  return {
    kink,
    lowerLen,
    lowerAngle: Math.atan2(kink.y, kink.x),
    upperLen,
    upperAngle: Math.atan2(upperDy, upperDx),
    upperUx: upperDx / upperLen,
    upperUy: upperDy / upperLen,
    upperNx: -upperDy / upperLen,
    upperNy: upperDx / upperLen,
    lowerNx: -kink.y / lowerLen,
    lowerNy: kink.x / lowerLen,
  };
}

/**
 * Factory pin / mount / stroke / stop geometry.
 * Coordinates match ReferenceBoom / ReferenceArm / four-bar meshes.
 */
export const WE = {
  boomLen: BOOM_LEN,
  armLen: ARM_LEN,
  /**
   * Legacy chassis ear (unused for lift visual — cylinder rides on the boom).
   * Kept so older call sites type-check.
   */
  boomLiftChassis: { x: 0.02, y: -0.02 } as Vec2,
  /**
   * Boom-frame “위” = upper-gooseneck 등/뒤 (+upperN).
   * Sit inside the open U-channel (below side-wall tops).
   */
  /** Sit on the solid boom 등 (half of ~0.34 beam height). */
  channelTop: 0.17,
  /** Barrel start along upper gooseneck — just past the kink elbow cover. */
  armCylBarrelT: 0.1,
  /**
   * Boom-lift cylinder rides on the lower gooseneck 등 (chassis / outer side).
   * Barrel near the foot; rod slides toward the kink with boom joint.
   */
  boomLiftAlongBarrel: 0.12,
  /** Rod tip travels only inside the 45° kink cover pocket (near kink). */
  boomLiftAlongRodMin: 0.78,
  boomLiftAlongRodMax: 0.96,
  /** Offset from lower centerline onto the dorsal face (+lowerN, chassis side). */
  boomLiftDorsal: 0.17,
  /** Arm dorsal height — cylinder axis Y (must match arm +X line). */
  armDorsalY: 0.15,
  /**
   * Fallback — prefer {@link getBucketCylMeetLocal}.
   * Arm-cyl rear on arm 등 after the joint jumper.
   */
  bucketCylBarrel: { x: 0.24, y: 0.15 } as Vec2,
  /**
   * H-link cylinder pin (bucket-local).
   * Kept near the arm-dorsal line through the dig range.
   */
  hLinkCylPin: { x: 0.19, y: 0.08 } as Vec2,
  /** H-link to bucket pin (bucket-local). */
  hLinkBucketPin: { x: 0.2, y: -0.02 } as Vec2,
  /** I-link / dogbone arm-side pin near tip (arm-local, at arm tip = bucket pivot). */
  iLinkArmPin: { x: -0.06, y: 0.15 } as Vec2,
  /** Clevis / coupler */
  clevisPlateZ: 0.175,
  couplerPin2: { x: -0.28, y: -0.1 } as Vec2,
  /**
   * Cylinder stroke pin-to-pin lengths (metres).
   * Tuned to the factory pin geometry so mechStops remain reachable;
   * slightly inside the measured envelope for a firm end-stop feel.
   */
  /**
   * Boom-lift pin distances along lower 등 (barrel → kink-pocket rod).
   * Tuned to kinkAlong≈0.55 lowerLen≈1.8 (raised≈1.19, lowered≈1.51).
   */
  boomLiftStroke: { min: 1.12, max: 1.55 },
  /** Boom-등 cylinder kink → boom tip only (length ~constant; not an arm joint). */
  armCylStroke: { min: 1.5, max: 2.0 },
  /** Arm cylinder along arm 등 (ΔX only). */
  bucketCylStroke: { min: 1.85, max: 2.45 },
  /** Mechanical hard stops (rad, sim joint space) before stroke tightening. */
  mechStops: {
    boomMin: getBoomRaiseMinJoint(),
    boomMax: 1.42,
    /** Inward fold — keep deep; do not let boom-cyl stroke edits shrink this. */
    armMin: -2.55,
    /**
     * Outward / up toward boom — stop a bit before colinear (0) so the arm
     * cannot fold past a near-horizontal match with the boom.
     */
    armMax: -0.48,
    bucketMin: 0.75,
    bucketMax: 3.45,
  },
  /** Soft fold clearance — matches armMax near-boom-horizontal stop. */
  armFoldSoftMax: -0.48,
  /** Collision sample fractions along boom/arm kinematic axis. */
  boomCollisionT: [0.12, 0.28, 0.42, 0.55, 0.7, 0.85, 0.96] as const,
  armCollisionT: [0.12, 0.28, 0.45, 0.62, 0.78, 0.92] as const,
  /** Bucket contact locals (bucket frame, tip toward -X) — wedge teeth. */
  bucketScraperLocals: [
    [-1.26, -0.4],
    [-1.12, -0.44],
    [-0.98, -0.5],
    [-0.82, -0.54],
  ] as const,
  bucketBodyLocals: [
    [-0.72, -0.5],
    [-0.4, -0.44],
    [-0.12, -0.2],
    [0.05, -0.06],
  ] as const,
} as const;

/**
 * Boom-cylinder rod end in BOOM-local — boom tip 등 only.
 * Must not be arm-local / must not rotate with the arm.
 */
export function getArmCylRodBoomTip(boomLen: number = BOOM_LEN): Vec2 {
  const g = getGooseneckGeometry(boomLen);
  const r = WE.channelTop;
  return {
    x: boomLen + g.upperNx * r,
    y: g.upperNy * r,
  };
}

/**
 * Boom-cylinder tip in ARM-local (arm origin = boom tip).
 * Start of the short hydraulic jumper under the joint cover.
 */
export function getArmCylRodLocal(boomLen: number = BOOM_LEN): Vec2 {
  const tip = getArmCylRodBoomTip(boomLen);
  return { x: tip.x - boomLen, y: tip.y };
}

/**
 * Arm-cylinder rear on the ARM 등 (straight +X, Y = armDorsalY).
 * Jumper from boom-cyl tip → here; cover is one plate over that seam.
 */
export function getBucketCylMeetLocal(_boomLen: number = BOOM_LEN): Vec2 {
  return { x: 0.24, y: WE.armDorsalY };
}

/** Arm-tip dorsal pin — cylinder stays on this +X line (arm-local). */
export function getArmCylTipLocal(armLen: number = ARM_LEN): Vec2 {
  return { x: armLen - 0.04, y: WE.armDorsalY };
}

/** Point on the lower gooseneck 등 / chassis side (boom-local, +lowerN). */
export function getBoomLiftDorsalPoint(
  along: number,
  boomLen: number = BOOM_LEN,
): Vec2 {
  const g = getGooseneckGeometry(boomLen);
  const dorsal = WE.boomLiftDorsal;
  return {
    x: g.kink.x * along + g.lowerNx * dorsal,
    y: g.kink.y * along + g.lowerNy * dorsal,
  };
}

/** @deprecated use {@link getBoomLiftDorsalPoint} */
export function getBoomLiftBellyPoint(
  along: number,
  boomLen: number = BOOM_LEN,
): Vec2 {
  return getBoomLiftDorsalPoint(along, boomLen);
}

/** Rod slide 0→1 from raised (short) to lowered (long). */
export function boomLiftRodSlide(boomJoint: number): number {
  const span = WE.mechStops.boomMax - WE.mechStops.boomMin;
  if (span <= 1e-6) return 0.5;
  return Math.max(
    0,
    Math.min(1, (boomJoint - WE.mechStops.boomMin) / span),
  );
}

/** Boom-local lift anchors — on the lower boom 등 (chassis side). */
export function getBoomLiftAnchors(
  boomJoint: number,
  boomLen: number = BOOM_LEN,
) {
  const slide = boomLiftRodSlide(boomJoint);
  const alongRod =
    WE.boomLiftAlongRodMin +
    slide * (WE.boomLiftAlongRodMax - WE.boomLiftAlongRodMin);
  return {
    barrel: getBoomLiftDorsalPoint(WE.boomLiftAlongBarrel, boomLen),
    rod: getBoomLiftDorsalPoint(alongRod, boomLen),
  };
}

/** Boom-local pin anchors shared by meshes + pose. */
export function getBoomPinAnchors(boomLen: number = BOOM_LEN) {
  const g = getGooseneckGeometry(boomLen);
  const top = WE.channelTop;
  /** Nominal rod lug (mid stroke) for static mount meshes. */
  const boomLiftRod = getBoomLiftDorsalPoint(
    (WE.boomLiftAlongRodMin + WE.boomLiftAlongRodMax) * 0.5,
    boomLen,
  );
  const boomLiftBarrel = getBoomLiftDorsalPoint(WE.boomLiftAlongBarrel, boomLen);
  const armCylBarrel: Vec2 = {
    x: g.kink.x + (boomLen - g.kink.x) * WE.armCylBarrelT + g.upperNx * top,
    y: g.kink.y + (0 - g.kink.y) * WE.armCylBarrelT + g.upperNy * top,
  };
  /** Boom tip 등 — cylinder ends here, never on the arm. */
  const armCylRod: Vec2 = getArmCylRodBoomTip(boomLen);
  return { ...g, boomLiftBarrel, boomLiftRod, armCylBarrel, armCylRod };
}

/** Visual boom rotation used in scene: π/2 − boomJoint. */
export function boomVisualRotation(boomJoint: number) {
  return Math.PI / 2 - boomJoint;
}

export function boomLiftPinDistance(boomJoint: number, boomLen: number = BOOM_LEN): number {
  const a = getBoomLiftAnchors(boomJoint, boomLen);
  return hypot(a.rod.x - a.barrel.x, a.rod.y - a.barrel.y);
}

/** Boom cylinder pin distance — boom tip only (ignores arm joint). */
export function armCylPinDistance(_armJoint: number, boomLen: number = BOOM_LEN): number {
  const a = getBoomPinAnchors(boomLen);
  return hypot(a.armCylRod.x - a.armCylBarrel.x, a.armCylRod.y - a.armCylBarrel.y);
}

export function bucketCylPinDistance(
  bucketJoint: number,
  armLen: number = ARM_LEN,
  boomLen: number = BOOM_LEN,
): number {
  const start = getBucketCylMeetLocal(boomLen);
  const hEnd = rotate(WE.hLinkCylPin, bucketJoint);
  const endX = Math.max(start.x + 0.4, armLen + hEnd.x);
  // Parallel to arm 등 — distance is |ΔX| only.
  return Math.abs(endX - start.x);
}

function clampRangeByStroke(
  sample: (angle: number) => number,
  mechMin: number,
  mechMax: number,
  strokeMin: number,
  strokeMax: number,
  steps = 80,
): { min: number; max: number } {
  let min = mechMax;
  let max = mechMin;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = mechMin + (mechMax - mechMin) * t;
    const d = sample(angle);
    if (d >= strokeMin && d <= strokeMax) {
      min = Math.min(min, angle);
      max = Math.max(max, angle);
    }
  }
  if (min > max) {
    return { min: mechMin, max: mechMax };
  }
  return {
    min: Math.max(mechMin, min),
    max: Math.min(mechMax, max),
  };
}

/** Joint limits from cylinder stroke ∩ mechanical stops (factory-like). */
export function getFactoryJointLimits() {
  const boomStroke = clampRangeByStroke(
    (b) => boomLiftPinDistance(b),
    WE.mechStops.boomMin,
    WE.mechStops.boomMax,
    WE.boomLiftStroke.min,
    WE.boomLiftStroke.max,
  );
  const bucketStroke = clampRangeByStroke(
    (k) => bucketCylPinDistance(k),
    WE.mechStops.bucketMin,
    WE.mechStops.bucketMax,
    WE.bucketCylStroke.min,
    WE.bucketCylStroke.max,
  );

  return {
    boom: {
      min: Math.max(WE.mechStops.boomMin, boomStroke.min),
      max: Math.min(WE.mechStops.boomMax, boomStroke.max),
    },
    /**
     * Arm fold is mechanical only.
     * Boom cylinder ends at the boom tip and no longer tracks the arm joint,
     * so armCylStroke must NOT shrink arm.min/max.
     */
    arm: {
      min: WE.mechStops.armMin,
      max: Math.min(WE.mechStops.armMax, WE.armFoldSoftMax),
    },
    bucket: {
      min: Math.max(WE.mechStops.bucketMin, bucketStroke.min),
      max: Math.min(WE.mechStops.bucketMax, bucketStroke.max),
    },
  } as const;
}

export const FACTORY_JOINT_LIMITS = getFactoryJointLimits();
