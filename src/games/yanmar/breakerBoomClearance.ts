import { JOINT_LIMITS } from "./controls";
import { YANMAR_MACHINE_RIG } from "./machineVisualTheme";
import type { ExcavatorSimState } from "./types";

const {
  boomLength: BOOM_LEN,
  armLength: ARM_LEN,
  armRotationScale: ARM_SCALE,
  bucketRotationScale: BUCKET_SCALE,
  breakerRotationZ: BREAKER_ROT,
  breakerTipLocalX: TIP_LX,
  breakerTipLocalY: TIP_LY,
} = YANMAR_MACHINE_RIG;

/**
 * Boom stick half-width + paint margin in the kinematic plane.
 * Tuned so a folded breaker tip must clear the boom shell, not just the axis.
 */
const BOOM_HIT_RADIUS = 0.38;
/** Keep a little air between breaker metal and boom paint. */
const CLEARANCE_MARGIN = 0.1;
/**
 * Ignore the last fraction of the boom near the arm pin — the coupler lives
 * there and would otherwise always "hit".
 */
const BOOM_EXCLUDE_TIP_T = 0.88;

/**
 * Breaker body samples in attachment-local (before breakerRotationZ).
 * Skip the root so the mount itself never false-triggers.
 */
const BREAKER_HIT_LOCALS: ReadonlyArray<readonly [number, number]> = [
  [-0.55, -0.1],
  [-0.85, -0.12],
  [-1.15, -0.14],
  [-1.45, -0.15],
  [-1.75, -0.15],
  [-2.0, -0.15],
  [TIP_LX, TIP_LY],
];

type Vec2 = { x: number; y: number };

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function distPointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-12) return Math.hypot(px - ax, py - ay);
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / len2, 0, 1);
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

/** Boom-plane XY of an attachment-local point (same basis as bucketPointWorld). */
function breakerPointPlanar(
  boom: number,
  arm: number,
  bucket: number,
  localX: number,
  localY: number,
): Vec2 {
  const rotX =
    Math.cos(BREAKER_ROT) * localX - Math.sin(BREAKER_ROT) * localY;
  const rotY =
    Math.sin(BREAKER_ROT) * localX + Math.cos(BREAKER_ROT) * localY;
  const boomEndX = Math.sin(boom) * BOOM_LEN;
  const boomEndY = Math.cos(boom) * BOOM_LEN;
  const visualArm = boom - arm * ARM_SCALE;
  const visualBucket = visualArm - bucket * BUCKET_SCALE;
  const armEndX = boomEndX + Math.sin(visualArm) * ARM_LEN;
  const armEndY = boomEndY + Math.cos(visualArm) * ARM_LEN;
  return {
    x: armEndX + Math.sin(visualBucket) * rotX - Math.cos(visualBucket) * rotY,
    y: armEndY + Math.cos(visualBucket) * rotX + Math.sin(visualBucket) * rotY,
  };
}

function boomSegmentEndpoints(boom: number): { a: Vec2; b: Vec2 } {
  return {
    a: { x: 0, y: 0 },
    b: {
      x: Math.sin(boom) * BOOM_LEN * BOOM_EXCLUDE_TIP_T,
      y: Math.cos(boom) * BOOM_LEN * BOOM_EXCLUDE_TIP_T,
    },
  };
}

/** True when any breaker body sample is inside the boom stick + margin. */
export function breakerHitsBoom(sim: ExcavatorSimState): boolean {
  const { a, b } = boomSegmentEndpoints(sim.boom);
  const need = BOOM_HIT_RADIUS + CLEARANCE_MARGIN;
  for (const [lx, ly] of BREAKER_HIT_LOCALS) {
    const p = breakerPointPlanar(sim.boom, sim.arm, sim.bucket, lx, ly);
    if (distPointToSegment(p.x, p.y, a.x, a.y, b.x, b.y) < need) {
      return true;
    }
  }
  return false;
}

/**
 * Unfold the arm (and nudge bucket if needed) until the breaker clears the boom.
 * Used when swapping to breaker while the arm is tightly curled.
 */
export function resolveBreakerBoomClearance(sim: ExcavatorSimState): boolean {
  if (!breakerHitsBoom(sim)) return true;

  const armMax = JOINT_LIMITS.arm.max;
  const bucketMax = JOINT_LIMITS.bucket.max;
  const startArm = sim.arm;
  const startBucket = sim.bucket;

  // 1) Binary-search the least arm unfold that clears.
  if (startArm < armMax - 1e-4) {
    let lo = startArm;
    let hi = armMax;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) * 0.5;
      sim.arm = mid;
      if (breakerHitsBoom(sim)) lo = mid;
      else hi = mid;
    }
    sim.arm = hi;
    if (!breakerHitsBoom(sim)) return true;
  }

  // 2) Still colliding at arm max — dump the coupler a bit to swing the tip out.
  sim.arm = armMax;
  if (startBucket < bucketMax - 1e-4) {
    let lo = startBucket;
    let hi = bucketMax;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) * 0.5;
      sim.bucket = mid;
      if (breakerHitsBoom(sim)) lo = mid;
      else hi = mid;
    }
    sim.bucket = hi;
    if (!breakerHitsBoom(sim)) return true;
  }

  // Best-effort: leave at max unfold even if still tight.
  sim.arm = armMax;
  sim.bucket = Math.max(sim.bucket, startBucket);
  return !breakerHitsBoom(sim);
}
