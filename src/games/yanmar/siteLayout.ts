export type SitePoint = readonly [x: number, z: number];

export interface SiteRoad {
  id: "entry" | "dump" | "crash" | "hill";
  from: SitePoint;
  to: SitePoint;
  width: number;
  unlockTier: 1 | 2 | 3;
  surface: "compacted" | "gravel";
}

export const SITE_LAYOUT = {
  spawn: [-18, -22] as SitePoint,
  /** Near dump truck (~21m) for short dig↔haul loops */
  dig: [18, 2] as SitePoint,
  dump: [33.27, -12.68] as SitePoint,
  crash: [108, 12] as SitePoint,
  hill: [22, 112] as SitePoint,
  /** North edge (minimap 12 o'clock) — Yanmar pylon monument */
  monument: [48, 132] as SitePoint,
  /** Minimap bottom-left (world SE) — excavator sports meet portal */
  sportsPortal: [78, -38] as SitePoint,
  coreMaxX: 80,
  coreMaxZ: 80,
  roads: [
    {
      id: "entry",
      from: [-18, -22],
      to: [18, 2],
      width: 5.6,
      unlockTier: 1,
      surface: "compacted",
    },
    {
      id: "dump",
      from: [18, 2],
      to: [33.27, -12.68],
      width: 4.8,
      unlockTier: 1,
      surface: "gravel",
    },
    {
      id: "crash",
      from: [35, -5],
      to: [108, 12],
      width: 6.4,
      unlockTier: 2,
      surface: "compacted",
    },
    {
      id: "hill",
      from: [10, 34],
      to: [42, 100],
      width: 6.2,
      unlockTier: 3,
      surface: "gravel",
    },
  ] satisfies SiteRoad[],
} as const;

export function distanceToSiteSegment(
  px: number,
  pz: number,
  from: SitePoint,
  to: SitePoint,
) {
  const abx = to[0] - from[0];
  const abz = to[1] - from[1];
  const lengthSq = abx * abx + abz * abz;
  if (lengthSq < 0.001) return Math.hypot(px - from[0], pz - from[1]);
  const t = Math.max(
    0,
    Math.min(1, ((px - from[0]) * abx + (pz - from[1]) * abz) / lengthSq),
  );
  return Math.hypot(px - (from[0] + abx * t), pz - (from[1] + abz * t));
}

export function getSiteRoadsForTier(tier: 1 | 2 | 3) {
  return SITE_LAYOUT.roads.filter((road) => road.unlockTier <= tier);
}
