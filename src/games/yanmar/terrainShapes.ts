import { getDumpTruckLaneSegment } from "./dumpTruckLane";
import {
  distanceToSiteSegment,
  getSiteRoadsForTier,
  SITE_LAYOUT,
} from "./siteLayout";

function terrainSeed(wx: number, wz: number) {
  return Math.abs(Math.sin(wx * 0.31 + wz * 0.47) * 43758.5453) % 1;
}

function distance(ax: number, az: number, bx: number, bz: number) {
  return Math.sqrt((ax - bx) ** 2 + (az - bz) ** 2);
}

function distanceToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
) {
  const abx = bx - ax;
  const abz = bz - az;
  const lenSq = abx * abx + abz * abz;
  if (lenSq < 0.001) return distance(px, pz, ax, az);
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / lenSq));
  const cx = ax + abx * t;
  const cz = az + abz * t;
  return distance(px, pz, cx, cz);
}

/** 굴착 구역 흙더미 — 둥근 봉우리 + 불규칙 요철 */
export function computeMoundHeight(
  dist: number,
  radius: number,
  wx: number,
  wz: number,
) {
  const t = 1 - dist / radius;
  if (t <= 0) return 0;
  const seed = terrainSeed(wx, wz);
  const peak = Math.pow(t, 1.18) * 1.72;
  const ripples = Math.sin(dist * 1.15 + seed * 6.28) * 0.11 * t;
  const lumps = Math.sin(dist * 2.35 + seed * 12.5) * 0.06 * t * t;
  const noise = (seed - 0.5) * 0.16 * t;
  const rim = t > 0.82 ? (t - 0.82) * 0.35 : 0;
  return peak + ripples + lumps + noise + rim;
}

export interface BaseTerrainContext {
  wx: number;
  wz: number;
  zoneDist: number | null;
  zoneRadius: number;
  zoneSeed: number;
}

export function computeBaseTerrainHeight(
  wx: number,
  wz: number,
  zone: { x: number; z: number; radius: number } | null,
  dumpPad?: { x: number; z: number; radius: number },
): number {
  const seed = terrainSeed(wx, wz);
  let h = 0.66 + seed * 0.2;
  h += Math.sin(wx * 0.07 + 1.2) * 0.035 + Math.cos(wz * 0.055 - 0.8) * 0.028;

  const roadDist = distanceToSiteSegment(
    wx,
    wz,
    SITE_LAYOUT.spawn,
    SITE_LAYOUT.dig,
  );
  if (roadDist < 3.2) {
    const blend = 1 - roadDist / 3.2;
    h = h + (0.71 - h) * blend * 0.84;
  }

  if (dumpPad) {
    const dumpDist = distance(wx, wz, dumpPad.x, dumpPad.z);
    if (dumpDist < dumpPad.radius) {
      const blend = 1 - dumpDist / dumpPad.radius;
      h = h + (0.73 - h) * blend * 0.72;
    }
  }

  if (zone) {
    const dist = distance(wx, wz, zone.x, zone.z);
    if (dist < zone.radius) {
      return 0.84 + computeMoundHeight(dist, zone.radius, wx, wz) + seed * 0.08;
    }
  }

  return h;
}

/** 트럭 주차·퇴장로 — 도로 메시(≈0.71)와 맞춘 평탱 지반 */
export function applyTruckDeparturePad(
  wx: number,
  wz: number,
  h: number,
  truck: { groupX: number; groupZ: number; rotation: number },
) {
  const { startX, startZ, endX, endZ } = getDumpTruckLaneSegment();
  const target = 0.71;

  const padDist = Math.hypot(wx - truck.groupX, wz - truck.groupZ);
  if (padDist < 6.4) {
    const blend = 1 - padDist / 6.4;
    h = h + (target - h) * blend * 0.94;
  }

  const laneDist = distanceToSegment(wx, wz, startX, startZ, endX, endZ);
  if (laneDist < 3) {
    const blend = 1 - laneDist / 3;
    h = h + (target - h) * blend * 0.96;
  }

  return h;
}

export function applyZoneMoundHeight(
  wx: number,
  wz: number,
  zone: { x: number; z: number; radius: number },
  current: number,
) {
  const dist = distance(wx, wz, zone.x, zone.z);
  if (dist >= zone.radius) return current;
  const moundH = 0.84 + computeMoundHeight(dist, zone.radius, wx, wz) + terrainSeed(wx, wz) * 0.08;
  return Math.max(current, moundH);
}

export function applyCrashAsphaltPad(
  wx: number,
  wz: number,
  h: number,
  zone: { centerX: number; centerZ: number; width: number; depth: number },
) {
  const dx = Math.abs(wx - zone.centerX);
  const dz = Math.abs(wz - zone.centerZ);
  const feather = 2.4;
  const outsideX = Math.max(0, dx - zone.width / 2);
  const outsideZ = Math.max(0, dz - zone.depth / 2);
  const outside = Math.hypot(outsideX, outsideZ);
  if (outside >= feather) return h;
  const blend = 1 - outside / feather;
  return h + (0.735 - h) * Math.min(1, blend * 0.96);
}

export function applyHillZoneHeight(
  wx: number,
  wz: number,
  h: number,
  zone: { centerX: number; centerZ: number; radius: number },
) {
  const dist = distance(wx, wz, zone.centerX, zone.centerZ);
  if (dist >= zone.radius + 8) return h;
  const t = Math.max(0, Math.min(1, 1 - dist / (zone.radius + 8)));
  const smooth = t * t * (3 - 2 * t);
  const plateau = dist < zone.radius * 0.42 ? 1 : Math.max(0, 1 - dist / zone.radius);
  const target = 0.76 + smooth * 5.2 + plateau * 0.65;
  return Math.max(h, target);
}

export function applyExpansionRoads(
  wx: number,
  wz: number,
  h: number,
  tier: 1 | 2 | 3 = 3,
) {
  for (const road of getSiteRoadsForTier(tier).filter(
    (item) => item.unlockTier > 1,
  )) {
    const distance = distanceToSiteSegment(wx, wz, road.from, road.to);
    const shoulder = road.width / 2 + 2;
    if (distance >= shoulder) continue;
    const blend = 1 - distance / shoulder;
    const crown = distance < road.width / 2 ? 0.02 * (1 - distance / (road.width / 2)) : 0;
    h += (0.74 + crown - h) * blend * 0.9;
  }
  return h;
}
