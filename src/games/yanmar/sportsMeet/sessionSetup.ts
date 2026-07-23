import {
  createSportsCrashZone,
  createSportsHillZone,
  createTerrain,
  DUMP_TRUCK,
  rebakeSpecialSiteSurfaces,
  sampleHeight,
  type TerrainData,
} from "../terrain";
import { distanceToSiteSegment, type SitePoint } from "../siteLayout";
import type { YanmarEquipmentStats } from "../equipment";
import type { SportsMeetMissionBalance } from "./missionBalance";
import {
  getSportsMeetTrackSegments,
  type SportsMeetPattern,
} from "./patterns";
import { PRACTICE_FULL_UNLOCK_LEVEL } from "@/lib/playerUnlocks";

/** Full main worksite terrain kept aside while sports map is active. */
export type SportsMainTerrainHold = TerrainData;

function distanceToTrack(
  wx: number,
  wz: number,
  segments: Array<{ from: SitePoint; to: SitePoint }>,
) {
  let best = Infinity;
  for (const seg of segments) {
    best = Math.min(
      best,
      distanceToSiteSegment(wx, wz, seg.from, seg.to),
    );
  }
  return best;
}

/**
 * Flatten the arena into a festival pad with a raised race corridor —
 * distinct from the rolling main worksite.
 */
function sculptSportsMeetArena(
  terrain: TerrainData,
  pattern: SportsMeetPattern,
) {
  const segments = getSportsMeetTrackSegments(pattern);
  const dig = pattern.zones.dig;
  const crash = pattern.zones.crash;
  const hill = pattern.zones.hill;

  for (let gz = 0; gz < terrain.gridSizeZ; gz++) {
    for (let gx = 0; gx < terrain.gridSizeX; gx++) {
      const idx = gz * terrain.gridSizeX + gx;
      const wx = terrain.originX + (gx + 0.5) * terrain.cellSize;
      const wz = terrain.originZ + (gz + 0.5) * terrain.cellSize;
      const trackDist = distanceToTrack(wx, wz, segments);
      const digDist = Math.hypot(wx - dig[0], wz - dig[1]);
      const crashDist = Math.hypot(wx - crash[0], wz - crash[1]);
      const hillDist = Math.hypot(wx - hill[0], wz - hill[1]);
      const dumpDist = Math.hypot(wx - DUMP_TRUCK.groupX, wz - DUMP_TRUCK.groupZ);

      // Soft festival pad — flatter and slightly warmer than main site.
      let h = 0.7;
      const ripple =
        Math.sin(wx * 0.045 + 0.4) * 0.012 + Math.cos(wz * 0.038 - 0.2) * 0.01;
      h += ripple;

      if (trackDist < 5.2) {
        const blend = 1 - trackDist / 5.2;
        h = h + (0.715 - h) * blend;
      }
      if (dumpDist < 10) {
        const blend = 1 - dumpDist / 10;
        h = h + (0.71 - h) * blend * 0.9;
      }
      // Keep work pads readable.
      if (crashDist < 16) {
        const blend = 1 - crashDist / 16;
        h = h + (0.72 - h) * blend * 0.85;
      }
      if (hillDist < 18) {
        const blend = 1 - hillDist / 18;
        h = h + (0.78 - h) * blend * 0.55;
      }
      // Keep the createTerrain dig mound (DIG_ZONE matches sports dig).
      if (digDist < 12.5) continue;

      terrain.heights[idx] = h;
      terrain.baseHeights[idx] = h;
    }
  }
}

/** Build an isolated sports arena with this week's linear course layout. */
export function createSportsMeetTerrain(
  pattern: SportsMeetPattern,
  mission: SportsMeetMissionBalance,
): TerrainData {
  const terrain = createTerrain(-48, -48, false, PRACTICE_FULL_UNLOCK_LEVEL);
  sculptSportsMeetArena(terrain, pattern);
  applySportsMeetTerrain(terrain, mission, pattern);
  rebakeSpecialSiteSurfaces(terrain);
  return terrain;
}

/** Place dig/crash/hill from pattern + mission quotas. */
export function applySportsMeetTerrain(
  terrain: TerrainData,
  mission: SportsMeetMissionBalance,
  pattern: SportsMeetPattern,
) {
  const [digX, digZ] = pattern.zones.dig;
  const [crashX, crashZ] = pattern.zones.crash;
  const [hillX, hillZ] = pattern.zones.hill;

  terrain.digZones = [
    {
      id: "sports-dig",
      x: digX,
      z: digZ,
      radius: 12,
      capacityUnits: mission.dig.digPileCapacity,
      remainingUnits: mission.dig.digPileCapacity,
      active: true,
      depletedAt: null,
      respawnAt: null,
    },
  ];

  terrain.crashZone = createSportsCrashZone(
    crashX,
    crashZ,
    mission.crash.asphaltTileCount,
  );

  terrain.hillZone = createSportsHillZone(
    hillX,
    hillZ,
    mission.hill.boulderCount,
    {
      phase: "ready",
      loadCount: 0,
      cooldownRemaining: 0,
      phaseElapsed: 0,
    },
  );
  // Keep haul pad beside the sports hill (main map HAUL_TRUCK coords are north-only).
  if (terrain.hillZone) {
    terrain.hillZone.dropX = hillX + 10;
    terrain.hillZone.dropZ = hillZ + 2;
  }
}

export function applySportsMeetEquipmentOverrides(
  stats: YanmarEquipmentStats,
  mission: SportsMeetMissionBalance,
): YanmarEquipmentStats {
  return {
    ...stats,
    truckCapacityUnits: mission.dig.dumpTruckCapacity,
    hillSafeLoadChance: mission.hill.failedLoadReuseChance,
    sportsMeetForceRockReuse: mission.hill.failedLoadReuseChance >= 1,
    haulTruckCapacity: Math.max(
      stats.haulTruckCapacity,
      mission.hill.successfulDumpsRequired,
    ),
  };
}

export function heightAtTerrain(terrain: TerrainData, x: number, z: number) {
  return sampleHeight(terrain, x, z);
}

/** @deprecated zone-only snapshot — prefer full terrain swap via createSportsMeetTerrain */
export type SportsTerrainSnapshot = {
  digZones: TerrainData["digZones"];
  crashZone: TerrainData["crashZone"];
  hillZone: TerrainData["hillZone"];
};

export function snapshotSportsTerrain(terrain: TerrainData): SportsTerrainSnapshot {
  return {
    digZones: terrain.digZones.map((z) => ({ ...z })),
    crashZone: terrain.crashZone
      ? {
          ...terrain.crashZone,
          tiles: terrain.crashZone.tiles.map((t) => ({ ...t })),
        }
      : null,
    hillZone: terrain.hillZone
      ? {
          ...terrain.hillZone,
          boulders: terrain.hillZone.boulders.map((b) => ({ ...b })),
          haulTruck: { ...terrain.hillZone.haulTruck },
        }
      : null,
  };
}

export function restoreSportsTerrain(
  terrain: TerrainData,
  snap: SportsTerrainSnapshot,
) {
  terrain.digZones = snap.digZones.map((z) => ({ ...z }));
  terrain.crashZone = snap.crashZone
    ? {
        ...snap.crashZone,
        tiles: snap.crashZone.tiles.map((t) => ({ ...t })),
      }
    : null;
  terrain.hillZone = snap.hillZone
    ? {
        ...snap.hillZone,
        boulders: snap.hillZone.boulders.map((b) => ({ ...b })),
        haulTruck: { ...snap.hillZone.haulTruck },
      }
    : null;
}
