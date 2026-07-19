import type { ExcavatorSimState } from "./types";
import { YANMAR_MACHINE_RIG } from "./machineVisualTheme";
import { GRAPPLE_GRAB_MIN_OPEN } from "./grappleGrip";
import { WE } from "./workEquipment/workEquipmentStructure";

/**
 * Hydraulic thumb (집게) — grab kinematics vs the bucket:
 *
 * 1. Hinge on the bucket NECK (back), tip toward the cutting edge.
 * 2. CLOSED (openAmount=0): clamp pad seats on the teeth / lip —
 *    object is squeezed between thumb and bucket.
 * 3. OPEN (openAmount→1): tip swings UP into the jaw mouth (free space
 *    above the teeth), away from the lip — room to approach a rock.
 * 4. Grab: open → place rock in that mouth gap → close onto the bucket.
 *
 * +1 rotation would swing the tip DOWN through the bowl floor (impossible).
 * −1 is the only valid open sense for “집기”.
 */
export const GRAPPLE_THUMB_HINGE = { x: 0.04, y: 0.2 } as const;

/**
 * Absolute max thumb open (rad) when the bucket is dumped / clear.
 * Wide jaw for grabbing; arm + floor scans still clamp when curled.
 */
export const GRAPPLE_THUMB_MAX_OPEN_RAD = (90 * Math.PI) / 180;

/**
 * Max openAmount at full bucket curl (bucket joint min).
 * Rises quickly as the bucket dumps (see {@link maxOpenFromBucketCurl}).
 */
export const GRAPPLE_OPEN_AT_FULL_CURL = 0.45;

/**
 * Open sign in bucket XY: −1 = tip rises into the jaw mouth (correct for grab).
 * +1 = tip dives through the bowl floor — never use.
 */
export const GRAPPLE_THUMB_OPEN_SIGN = -1;

const THUMB_HINGE_X = GRAPPLE_THUMB_HINGE.x;
const THUMB_HINGE_Y = GRAPPLE_THUMB_HINGE.y;

/** Closed tip in hinge-local — meets bucket scraper tips. */
const THUMB_TIP_LOCAL = { x: -1.26, y: -0.49 } as const;

/**
 * Thumb probes in hinge-local (closed pose).
 * Arm spine → tip bite pad at scraper contact.
 */
const THUMB_PROBE_LOCALS: ReadonlyArray<readonly [number, number]> = [
  [-1.28, -0.49],
  [-1.16, -0.52],
  [-1.0, -0.46],
  [-0.8, -0.36],
  [-0.58, -0.26],
  [-0.38, -0.16],
  [-0.18, -0.06],
  [-0.05, -0.02],
];

/** Floor penetration — tip + mid. */
const THUMB_BUCKET_HIT_LOCALS: ReadonlyArray<readonly [number, number]> =
  THUMB_PROBE_LOCALS.slice(0, 5);

/**
 * Arm hit — tip only. Mid/root samples sit near the pin and false-clamp
 * open amount even when the bucket is dumped.
 */
const THUMB_ARM_HIT_LOCALS: ReadonlyArray<readonly [number, number]> =
  THUMB_PROBE_LOCALS.slice(0, 3);

/**
 * Inner floor centerline (bucket-local) — matches ExcavatorBucket bowl.
 * A probe below this curve is inside the metal / through the shell.
 */
const BUCKET_FLOOR: ReadonlyArray<readonly [number, number]> = [
  [0.05, 0.1],
  [0.02, -0.08],
  [-0.12, -0.32],
  [-0.35, -0.5],
  [-0.62, -0.58],
  [-0.88, -0.54],
  [-1.06, -0.42],
  [-1.14, -0.36],
];

/** Arm link hit radius — tighter so only real tip-vs-stick clamps. */
const ARM_HIT_RADIUS = 0.22;
/** Keep tip probes clear of the bucket pin / arm tip joint. */
const ARM_JOINT_CLEARANCE = 0.55;
const ARM_ROOT_CLEARANCE = 0.2;
const OPEN_SCAN_STEPS = 64;
/** Margin under the floor before counting as through-shell. */
const FLOOR_PENETRATE_MARGIN = 0.04;
/** Curl envelope reaches full open by this dump fraction (0..1). */
const CURL_FULL_OPEN_AT = 0.5;

function thumbPointInBucketLocal(
  openAmount: number,
  localX: number,
  localY: number,
): { x: number; y: number } {
  const open = Math.max(0, Math.min(1, openAmount));
  const theta = GRAPPLE_THUMB_OPEN_SIGN * open * GRAPPLE_THUMB_MAX_OPEN_RAD;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  return {
    x: THUMB_HINGE_X + cosT * localX - sinT * localY,
    y: THUMB_HINGE_Y + sinT * localX + cosT * localY,
  };
}

function thumbPointInArmLocal(
  bucketAngle: number,
  openAmount: number,
  localX: number,
  localY: number,
): { x: number; y: number } {
  const p = thumbPointInBucketLocal(openAmount, localX, localY);
  const cosB = Math.cos(bucketAngle);
  const sinB = Math.sin(bucketAngle);
  return {
    x: YANMAR_MACHINE_RIG.armLength + cosB * p.x - sinB * p.y,
    y: sinB * p.x + cosB * p.y,
  };
}

function floorYAt(x: number): number | null {
  const pts = BUCKET_FLOOR;
  if (x > pts[0][0] || x < pts[pts.length - 1][0]) return null;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    // Floor runs toward −X
    if (x <= x0 && x >= x1) {
      const t = (x0 - x) / Math.max(1e-6, x0 - x1);
      return y0 + (y1 - y0) * t;
    }
  }
  return null;
}

/** True if a bucket-local point has gone through the bowl floor metal. */
function pointPenetratesBucketFloor(x: number, y: number): boolean {
  const fy = floorYAt(x);
  if (fy == null) return false;
  return y < fy - FLOOR_PENETRATE_MARGIN;
}

function pointHitsArmStick(px: number, py: number): boolean {
  const armLen = YANMAR_MACHINE_RIG.armLength;
  const x0 = ARM_ROOT_CLEARANCE;
  const x1 = armLen - ARM_JOINT_CLEARANCE;
  if (px < x0 - ARM_HIT_RADIUS || px > x1 + ARM_HIT_RADIUS) return false;
  const cx = Math.max(x0, Math.min(x1, px));
  const dist = Math.hypot(px - cx, py);
  return dist <= ARM_HIT_RADIUS;
}

function smoothstep01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/**
 * Curl envelope: full curl → {@link GRAPPLE_OPEN_AT_FULL_CURL},
 * reaches 1 once the bucket is about halfway dumped.
 */
function maxOpenFromBucketCurl(sim: ExcavatorSimState): number {
  const bMin = WE.mechStops.bucketMin;
  const bMax = WE.mechStops.bucketMax;
  const t = (sim.bucket - bMin) / Math.max(1e-6, bMax - bMin);
  const eased = smoothstep01(Math.min(1, t / CURL_FULL_OPEN_AT));
  return (
    GRAPPLE_OPEN_AT_FULL_CURL +
    (1 - GRAPPLE_OPEN_AT_FULL_CURL) * eased
  );
}

export function grappleOpenHitsBucket(openAmount: number): boolean {
  for (const [lx, ly] of THUMB_BUCKET_HIT_LOCALS) {
    const p = thumbPointInBucketLocal(openAmount, lx, ly);
    if (pointPenetratesBucketFloor(p.x, p.y)) return true;
  }
  return false;
}

export function grappleOpenHitsArm(
  sim: ExcavatorSimState,
  openAmount: number,
): boolean {
  const bucketAngle = sim.bucket * YANMAR_MACHINE_RIG.bucketRotationScale;

  for (const [lx, ly] of THUMB_ARM_HIT_LOCALS) {
    const p = thumbPointInArmLocal(bucketAngle, openAmount, lx, ly);
    if (pointHitsArmStick(p.x, p.y)) return true;
  }
  return false;
}

function maxOpenFromScan(hits: (open: number) => boolean): number {
  // Closed on teeth is always allowed (ignore false hits at open=0).
  if (!hits(1)) return 1;

  for (let i = 1; i <= OPEN_SCAN_STEPS; i++) {
    const open = i / OPEN_SCAN_STEPS;
    if (hits(open)) {
      return Math.max(0, (i - 1) / OPEN_SCAN_STEPS - 0.01);
    }
  }
  return 1;
}

/** Grab / wrap samples — current open, bucket-local. */
export function getGrappleThumbBucketLocals(
  openAmount: number,
): ReadonlyArray<readonly [number, number]> {
  return THUMB_PROBE_LOCALS.map(([lx, ly]) => {
    const p = thumbPointInBucketLocal(openAmount, lx, ly);
    return [p.x, p.y] as const;
  });
}

/**
 * Max safe grapple open [0..1] for the current pose.
 * - Opens away from teeth into the jaw mouth
 * - Never through the bucket shell
 * - Never into the arm stick
 * - Curl envelope limits how wide when bucket is tucked in
 */
export function maxSafeGrappleOpen(sim: ExcavatorSimState): number {
  const fromCurl = maxOpenFromBucketCurl(sim);
  const fromBucket = maxOpenFromScan((o) => grappleOpenHitsBucket(o));
  const fromArm = maxOpenFromScan((o) => grappleOpenHitsArm(sim, o));
  return Math.max(0, Math.min(1, fromCurl, fromBucket, fromArm));
}

export function clampGrappleOpenAgainstArm(
  sim: ExcavatorSimState,
  openAmount: number,
): number {
  const open = Math.max(0, Math.min(1, openAmount));
  return Math.min(open, maxSafeGrappleOpen(sim));
}

export function grappleOpenEnoughToGrab(
  sim: ExcavatorSimState,
  openAmount: number,
): boolean {
  const open = Math.max(0, Math.min(1, openAmount));
  const safeMax = maxSafeGrappleOpen(sim);
  const required = Math.min(
    GRAPPLE_GRAB_MIN_OPEN,
    Math.max(0.35, safeMax * 0.88),
  );
  return open >= required;
}
