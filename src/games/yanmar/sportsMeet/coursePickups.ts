import type { SitePoint } from "../siteLayout";
import type { SportsMeetMissionBalance } from "./missionBalance";
import type {
  SportsMeetCourseStar,
  SportsMeetSpeedBuffPickup,
} from "./types";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Sample points evenly along a polyline (by segment count, not arc length). */
export function samplePathPoints(
  path: readonly SitePoint[],
  count: number,
): SitePoint[] {
  if (count <= 0 || path.length === 0) return [];
  if (path.length === 1) {
    return Array.from({ length: count }, () => path[0]!);
  }
  const out: SitePoint[] = [];
  const segs = path.length - 1;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const f = t * segs;
    const i0 = Math.min(segs - 1, Math.floor(f));
    const local = f - i0;
    const a = path[i0]!;
    const b = path[i0 + 1]!;
    out.push([lerp(a[0], b[0], local), lerp(a[1], b[1], local)]);
  }
  return out;
}

export function buildCourseStars(
  path: readonly SitePoint[],
  mission: SportsMeetMissionBalance,
  heightAt: (x: number, z: number) => number,
): SportsMeetCourseStar[] {
  const points = samplePathPoints(path, mission.drive.starCount);
  return points.map((p, i) => ({
    id: `course-star-${i}`,
    x: p[0],
    y: heightAt(p[0], p[1]) + 1.15,
    z: p[1],
    collected: false,
  }));
}

export function buildSpeedBuffPickups(
  path: readonly SitePoint[],
  mission: SportsMeetMissionBalance,
  heightAt: (x: number, z: number) => number,
): SportsMeetSpeedBuffPickup[] {
  const n = mission.drive.speedBuffCount;
  if (n <= 0 || path.length < 2) return [];
  // Place between stars — offset along path mid-segments.
  const points = samplePathPoints(path, n + 2).slice(1, n + 1);
  return points.map((p, i) => ({
    id: `course-speed-${i}`,
    x: p[0],
    y: heightAt(p[0], p[1]) + 1.15,
    z: p[1],
    collected: false,
  }));
}

export const SPORTS_MEET_PICKUP_RADIUS = 2.4;
export const SPORTS_MEET_SPEED_BUFF_MS = 30_000;
export const SPORTS_MEET_SPEED_BUFF_MULT = 2;
export const SPORTS_MEET_COUNTDOWN_MS = 5_000;
export const SPORTS_MEET_UNLOCK_LEVEL = 25;
/** Minimap bottom-left ≈ world SE (high X, low Z). */
export const SPORTS_MEET_PORTAL = {
  x: 78,
  z: -38,
  radius: 10,
  rotationY: Math.PI * 0.15,
} as const;

export function distanceXZ(
  ax: number,
  az: number,
  bx: number,
  bz: number,
) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.hypot(dx, dz);
}

export function isInSportsMeetPortalRange(posX: number, posZ: number) {
  return (
    distanceXZ(posX, posZ, SPORTS_MEET_PORTAL.x, SPORTS_MEET_PORTAL.z) <=
    SPORTS_MEET_PORTAL.radius
  );
}
