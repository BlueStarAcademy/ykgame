export type MapTier = 1 | 2 | 3;

export const MAP_TIER_ORIGIN = { x: -48, z: -48 } as const;

export function getMapTierForLevel(level: number): MapTier {
  if (level >= 15) return 3;
  if (level >= 10) return 2;
  return 1;
}

export function getGridSizeForTier(tier: MapTier): {
  gridSizeX: number;
  gridSizeZ: number;
} {
  if (tier === 3) return { gridSizeX: 96, gridSizeZ: 96 };
  if (tier === 2) return { gridSizeX: 96, gridSizeZ: 64 };
  return { gridSizeX: 64, gridSizeZ: 64 };
}
