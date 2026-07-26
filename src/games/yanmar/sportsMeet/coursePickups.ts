import type { SitePoint } from "../siteLayout";
import type { SportsMeetMissionBalance } from "./missionBalance";
import type {
  SportsMeetCourseStar,
  SportsMeetSpeedBuffPickup,
} from "./types";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function catmullRom(
  p0: SitePoint,
  p1: SitePoint,
  p2: SitePoint,
  p3: SitePoint,
  t: number,
): SitePoint {
  const t2 = t * t;
  const t3 = t2 * t;
  const x =
    0.5 *
    (2 * p1[0] +
      (-p0[0] + p2[0]) * t +
      (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
      (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
  const z =
    0.5 *
    (2 * p1[1] +
      (-p0[1] + p2[1]) * t +
      (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
      (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
  return [x, z];
}

/** Smooth polyline for curvature sampling / nicer racing-line placement. */
export function densifyPolyline(
  path: readonly SitePoint[],
  samplesPerSegment = 5,
): SitePoint[] {
  if (path.length < 2) return path.map((p) => [p[0], p[1]] as SitePoint);
  if (samplesPerSegment <= 1) return path.map((p) => [p[0], p[1]] as SitePoint);
  const out: SitePoint[] = [];
  const n = path.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = path[Math.max(0, i - 1)]!;
    const p1 = path[i]!;
    const p2 = path[i + 1]!;
    const p3 = path[Math.min(n - 1, i + 2)]!;
    for (let s = 0; s < samplesPerSegment; s++) {
      out.push(catmullRom(p0, p1, p2, p3, s / samplesPerSegment));
    }
  }
  const last = path[n - 1]!;
  out.push([last[0], last[1]]);
  return out;
}

function polylineArcLength(path: readonly SitePoint[]): {
  lengths: number[];
  total: number;
  cumulative: number[];
} {
  const lengths: number[] = [];
  const cumulative: number[] = [0];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    lengths.push(len);
    total += len;
    cumulative.push(total);
  }
  return { lengths, total, cumulative };
}

function pointAtArcLength(
  path: readonly SitePoint[],
  cumulative: readonly number[],
  total: number,
  dist: number,
): { point: SitePoint; tangent: SitePoint; segIndex: number } {
  const d = Math.max(0, Math.min(total, dist));
  let i = 0;
  while (i < cumulative.length - 2 && cumulative[i + 1]! < d) i++;
  const a = path[i]!;
  const b = path[i + 1] ?? a;
  const segStart = cumulative[i]!;
  const segLen = Math.max(1e-6, (cumulative[i + 1] ?? total) - segStart);
  const t = (d - segStart) / segLen;
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const inv = 1 / Math.max(1e-6, Math.hypot(dx, dz));
  return {
    point: [lerp(a[0], b[0], t), lerp(a[1], b[1], t)],
    tangent: [dx * inv, dz * inv],
    segIndex: i,
  };
}

function vertexTurn(
  path: readonly SitePoint[],
  i: number,
): { angle: number; signed: number } {
  if (i <= 0 || i >= path.length - 1) return { angle: 0, signed: 0 };
  const prev = path[i - 1]!;
  const curr = path[i]!;
  const next = path[i + 1]!;
  const ax = curr[0] - prev[0];
  const az = curr[1] - prev[1];
  const bx = next[0] - curr[0];
  const bz = next[1] - curr[1];
  const la = Math.hypot(ax, az);
  const lb = Math.hypot(bx, bz);
  if (la < 1e-4 || lb < 1e-4) return { angle: 0, signed: 0 };
  const dot = Math.max(-1, Math.min(1, (ax * bx + az * bz) / (la * lb)));
  const angle = Math.acos(dot);
  const signed = Math.sign(ax * bz - az * bx) || 1;
  return { angle, signed };
}

/**
 * Sample points biased onto high-curvature (bend) sections of the path.
 * Applies a small inside-of-turn offset so cutting wide / leaving the track
 * makes collection harder while staying on the racing line is rewarded.
 */
export function sampleCurvedPathPoints(
  path: readonly SitePoint[],
  count: number,
  opts?: { insideOffset?: number; endTrim?: number },
): SitePoint[] {
  if (count <= 0 || path.length === 0) return [];
  if (path.length === 1) {
    return Array.from({ length: count }, () => path[0]!);
  }

  const smooth = densifyPolyline(path, 6);
  const { total, cumulative } = polylineArcLength(smooth);
  if (total < 1e-3) {
    return Array.from({ length: count }, () => smooth[0]!);
  }

  const endTrim = opts?.endTrim ?? 0.1;
  const insideOffset = opts?.insideOffset ?? 1.05;
  const startD = total * endTrim;
  const endD = total * (1 - endTrim);
  const usable = Math.max(1e-3, endD - startD);

  // Dense candidates scored by nearby bend strength.
  const candidateStep = Math.min(1.15, usable / Math.max(24, count * 4));
  type Cand = {
    dist: number;
    score: number;
    point: SitePoint;
    signed: number;
    tangent: SitePoint;
  };
  const candidates: Cand[] = [];
  for (let dist = startD; dist <= endD + 1e-6; dist += candidateStep) {
    const { point, tangent, segIndex } = pointAtArcLength(
      smooth,
      cumulative,
      total,
      dist,
    );
    // Blend turn angles of nearby vertices.
    let score = 0.08;
    let signed = 0;
    let weightSum = 0;
    for (let vi = 1; vi < smooth.length - 1; vi++) {
      const vDist = cumulative[vi] ?? 0;
      const proximity = Math.abs(vDist - dist);
      if (proximity > 14) continue;
      const turn = vertexTurn(smooth, vi);
      if (turn.angle < 0.12) continue;
      const w = 1 / (0.65 + proximity);
      score += turn.angle * turn.angle * w * 4.5;
      signed += turn.signed * turn.angle * w;
      weightSum += turn.angle * w;
    }
    // Prefer true bends over straights.
    if (weightSum > 1e-6) signed /= weightSum;
    // Mild boost near segment midpoints that sit between bent vertices.
    const midBoost =
      segIndex > 0 && segIndex < smooth.length - 2
        ? vertexTurn(smooth, segIndex).angle * 0.35 +
          vertexTurn(smooth, segIndex + 1).angle * 0.35
        : 0;
    score += midBoost;
    candidates.push({ dist, score, point, signed, tangent });
  }

  if (candidates.length === 0) {
    return samplePathPoints(path, count);
  }

  const minSpacing = usable / (count + 0.35);
  const picked: Cand[] = [];
  const pool = [...candidates].sort((a, b) => b.score - a.score);

  for (const cand of pool) {
    if (picked.length >= count) break;
    if (picked.some((p) => Math.abs(p.dist - cand.dist) < minSpacing)) continue;
    picked.push(cand);
  }

  // Fill remaining evenly if bends weren't enough.
  if (picked.length < count) {
    for (let i = 0; i < count && picked.length < count; i++) {
      const dist = startD + ((i + 0.5) / count) * usable;
      if (picked.some((p) => Math.abs(p.dist - dist) < minSpacing * 0.55)) {
        continue;
      }
      const { point, tangent } = pointAtArcLength(
        smooth,
        cumulative,
        total,
        dist,
      );
      picked.push({ dist, score: 0, point, signed: 0, tangent });
    }
  }

  picked.sort((a, b) => a.dist - b.dist);

  return picked.slice(0, count).map((cand) => {
    if (Math.abs(cand.signed) < 0.05 || insideOffset <= 0) {
      return cand.point;
    }
    // Inside of turn: opposite the outward normal of the bend.
    const rx = cand.tangent[1];
    const rz = -cand.tangent[0];
    const side = cand.signed >= 0 ? -1 : 1;
    return [
      cand.point[0] + rx * insideOffset * side,
      cand.point[1] + rz * insideOffset * side,
    ];
  });
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
    const t = count === 1 ? 0.5 : (i + 0.5) / count;
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
  starCount: number,
  heightAt: (x: number, z: number) => number,
  idPrefix = "course-star",
): SportsMeetCourseStar[] {
  const points = sampleCurvedPathPoints(path, starCount, {
    insideOffset: 1.1,
    endTrim: 0.1,
  });
  return points.map((p, i) => ({
    id: `${idPrefix}-${i}`,
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
