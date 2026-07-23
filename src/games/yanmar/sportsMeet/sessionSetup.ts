import {
  createSportsCrashZone,
  createSportsHillZone,
  createTerrain,
  sampleHeight,
  type TerrainData,
} from "../terrain";
import type { YanmarEquipmentStats } from "../equipment";
import type { SportsMeetMissionBalance } from "./missionBalance";
import type { SportsMeetPattern } from "./patterns";
import { PRACTICE_FULL_UNLOCK_LEVEL } from "@/lib/playerUnlocks";

/** Full main worksite terrain kept aside while sports map is active. */
export type SportsMainTerrainHold = TerrainData;

/** Build an isolated tier-3 sports arena with this week's zone layout. */
export function createSportsMeetTerrain(
  pattern: SportsMeetPattern,
  mission: SportsMeetMissionBalance,
): TerrainData {
  const terrain = createTerrain(-48, -48, false, PRACTICE_FULL_UNLOCK_LEVEL);
  applySportsMeetTerrain(terrain, mission, pattern);
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
