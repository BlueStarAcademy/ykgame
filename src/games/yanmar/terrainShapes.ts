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

  const roadDist = distanceToSegment(wx, wz, -18, -22, 4, 18);
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
