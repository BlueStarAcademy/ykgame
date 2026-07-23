import type { SitePoint } from "../siteLayout";
import type { ExcavatorSimState } from "../types";
import type { SportsMeetPattern } from "./patterns";

/** Narrow race-start enclosure before GO. */
export type SportsMeetStartPaddock = {
  /** World center of the paddock floor (spawn). */
  centerX: number;
  centerZ: number;
  /** Facing direction along the first drive leg (radians, +Z = 0 in excavator heading). */
  heading: number;
  /** Unit forward (course direction). */
  forwardX: number;
  forwardZ: number;
  /** Unit right. */
  rightX: number;
  rightZ: number;
  /** Start-line world position (front gate). */
  gateX: number;
  gateZ: number;
  halfWidth: number;
  /** Depth behind the gate (local −forward). */
  depth: number;
};

export const SPORTS_MEET_START_PADDOCK = {
  halfWidth: 4.2,
  depth: 11.5,
  /** Keep machine body inside walls. */
  wallMargin: 1.35,
} as const;

function normalize2(x: number, z: number): { x: number; z: number } {
  const len = Math.hypot(x, z);
  if (len < 1e-6) return { x: 0, z: 1 };
  return { x: x / len, z: z / len };
}

/**
 * Build a start-grid paddock just behind the first drive waypoint,
 * oriented toward the course.
 */
export function getSportsMeetStartPaddock(
  pattern: SportsMeetPattern,
): SportsMeetStartPaddock {
  const path = pattern.drivePaths[0] ?? pattern.drivePath;
  const gate = (path[0] ?? [-28, -22]) as SitePoint;
  const next = (path[1] ?? [gate[0] + 14, gate[1] + 4]) as SitePoint;
  const fwd = normalize2(next[0] - gate[0], next[1] - gate[1]);
  const right = { x: fwd.z, z: -fwd.x };
  const { halfWidth, depth } = SPORTS_MEET_START_PADDOCK;
  // Spawn mid-paddock, behind the gate.
  const centerX = gate[0] - fwd.x * (depth * 0.55);
  const centerZ = gate[1] - fwd.z * (depth * 0.55);
  // Excavator heading: 0 faces +Z; atan2(x,z) matches existing site usage.
  const heading = Math.atan2(fwd.x, fwd.z);

  return {
    centerX,
    centerZ,
    heading,
    forwardX: fwd.x,
    forwardZ: fwd.z,
    rightX: right.x,
    rightZ: right.z,
    gateX: gate[0],
    gateZ: gate[1],
    halfWidth,
    depth,
  };
}

export function worldToPaddockLocal(
  paddock: SportsMeetStartPaddock,
  x: number,
  z: number,
): { along: number; across: number } {
  const dx = x - paddock.gateX;
  const dz = z - paddock.gateZ;
  // along: +forward is past the gate (out); −forward is inside paddock
  const along =
    dx * paddock.forwardX + dz * paddock.forwardZ;
  const across = dx * paddock.rightX + dz * paddock.rightZ;
  return { along, across };
}

export function paddockLocalToWorld(
  paddock: SportsMeetStartPaddock,
  along: number,
  across: number,
): { x: number; z: number } {
  return {
    x:
      paddock.gateX +
      paddock.forwardX * along +
      paddock.rightX * across,
    z:
      paddock.gateZ +
      paddock.forwardZ * along +
      paddock.rightZ * across,
  };
}

/**
 * Clamp excavator inside the start paddock (cannot cross the start gate).
 * Returns true if movement was blocked.
 */
export function constrainSportsMeetStartPaddock(
  sim: ExcavatorSimState,
  paddock: SportsMeetStartPaddock,
): boolean {
  const margin = SPORTS_MEET_START_PADDOCK.wallMargin;
  const { along, across } = worldToPaddockLocal(paddock, sim.posX, sim.posZ);
  const minAlong = -paddock.depth + margin;
  const maxAlong = -margin; // cannot reach / cross the gate line
  const maxAcross = paddock.halfWidth - margin;

  const nextAlong = Math.max(minAlong, Math.min(maxAlong, along));
  const nextAcross = Math.max(-maxAcross, Math.min(maxAcross, across));
  if (nextAlong === along && nextAcross === across) return false;

  const world = paddockLocalToWorld(paddock, nextAlong, nextAcross);
  sim.posX = world.x;
  sim.posZ = world.z;
  return true;
}

export function isSportsMeetStartLocked(
  phase: string | null | undefined,
): boolean {
  return phase === "ready" || phase === "countdown";
}
