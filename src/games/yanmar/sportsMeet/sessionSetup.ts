import {
  createSportsCrashZone,
  createSportsHillZone,
  createTerrain,
  DUMP_TRUCK,
  rebakeSpecialSiteSurfaces,
  sampleHeight,
  type TerrainData,
} from "../terrain";
import type { SitePoint } from "../siteLayout";
import type { YanmarEquipmentStats } from "../equipment";
import type { SportsMeetMissionBalance } from "./missionBalance";
import {
  getSportsMeetTrackSegments,
  type SportsMeetPattern,
} from "./patterns";
import { PRACTICE_FULL_UNLOCK_LEVEL } from "@/lib/playerUnlocks";

/** Full main worksite terrain kept aside while sports map is active. */
export type SportsMainTerrainHold = TerrainData;

function worldToCell(
  terrain: TerrainData,
  wx: number,
  wz: number,
): { gx: number; gz: number } {
  return {
    gx: Math.floor((wx - terrain.originX) / terrain.cellSize),
    gz: Math.floor((wz - terrain.originZ) / terrain.cellSize),
  };
}

function setPadHeight(
  terrain: TerrainData,
  gx: number,
  gz: number,
  height: number,
  blend: number,
) {
  if (
    gx < 0 ||
    gz < 0 ||
    gx >= terrain.gridSizeX ||
    gz >= terrain.gridSizeZ
  ) {
    return;
  }
  const idx = gz * terrain.gridSizeX + gx;
  const h = terrain.heights[idx]!;
  const next = h + (height - h) * blend;
  terrain.heights[idx] = next;
  terrain.baseHeights[idx] = next;
}

/** Stamp a soft circle pad — O(radius²) instead of full-grid scans. */
function stampCirclePad(
  terrain: TerrainData,
  cx: number,
  cz: number,
  radius: number,
  height: number,
  strength: number,
) {
  const { gx: cgx, gz: cgz } = worldToCell(terrain, cx, cz);
  const cellR = Math.ceil(radius / terrain.cellSize) + 1;
  const r2 = radius * radius;
  for (let dz = -cellR; dz <= cellR; dz++) {
    for (let dx = -cellR; dx <= cellR; dx++) {
      const gx = cgx + dx;
      const gz = cgz + dz;
      if (
        gx < 0 ||
        gz < 0 ||
        gx >= terrain.gridSizeX ||
        gz >= terrain.gridSizeZ
      ) {
        continue;
      }
      const wx = terrain.originX + (gx + 0.5) * terrain.cellSize;
      const wz = terrain.originZ + (gz + 0.5) * terrain.cellSize;
      const d2 = (wx - cx) * (wx - cx) + (wz - cz) * (wz - cz);
      if (d2 > r2) continue;
      const blend = (1 - Math.sqrt(d2) / radius) * strength;
      setPadHeight(terrain, gx, gz, height, blend);
    }
  }
}

/**
 * Stamp a raised corridor along a polyline — walks cells near each segment
 * instead of testing every grid cell against every segment.
 */
function stampTrackCorridor(
  terrain: TerrainData,
  segments: Array<{ from: SitePoint; to: SitePoint }>,
  halfWidth: number,
  height: number,
) {
  const step = terrain.cellSize * 0.65;
  const cellR = Math.ceil(halfWidth / terrain.cellSize) + 1;
  const halfW2 = halfWidth * halfWidth;

  for (const seg of segments) {
    const dx = seg.to[0] - seg.from[0];
    const dz = seg.to[1] - seg.from[1];
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) continue;
    const ux = dx / len;
    const uz = dz / len;
    const samples = Math.max(1, Math.ceil(len / step));
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const px = seg.from[0] + dx * t;
      const pz = seg.from[1] + dz * t;
      const { gx: cgx, gz: cgz } = worldToCell(terrain, px, pz);
      for (let oz = -cellR; oz <= cellR; oz++) {
        for (let ox = -cellR; ox <= cellR; ox++) {
          const gx = cgx + ox;
          const gz = cgz + oz;
          if (
            gx < 0 ||
            gz < 0 ||
            gx >= terrain.gridSizeX ||
            gz >= terrain.gridSizeZ
          ) {
            continue;
          }
          const wx = terrain.originX + (gx + 0.5) * terrain.cellSize;
          const wz = terrain.originZ + (gz + 0.5) * terrain.cellSize;
          // Distance to infinite line, then clamp to segment.
          const vx = wx - seg.from[0];
          const vz = wz - seg.from[1];
          const proj = Math.max(0, Math.min(len, vx * ux + vz * uz));
          const qx = seg.from[0] + ux * proj;
          const qz = seg.from[1] + uz * proj;
          const d2 = (wx - qx) * (wx - qx) + (wz - qz) * (wz - qz);
          if (d2 > halfW2) continue;
          const blend = 1 - Math.sqrt(d2) / halfWidth;
          setPadHeight(terrain, gx, gz, height, blend);
        }
      }
    }
  }
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

  // Cheap base pad + light ripple (no per-cell segment scans).
  for (let gz = 0; gz < terrain.gridSizeZ; gz++) {
    for (let gx = 0; gx < terrain.gridSizeX; gx++) {
      const idx = gz * terrain.gridSizeX + gx;
      const wx = terrain.originX + (gx + 0.5) * terrain.cellSize;
      const wz = terrain.originZ + (gz + 0.5) * terrain.cellSize;
      const digDist = Math.hypot(wx - dig[0], wz - dig[1]);
      // Keep the createTerrain dig mound.
      if (digDist < 12.5) continue;

      const ripple =
        Math.sin(wx * 0.045 + 0.4) * 0.012 + Math.cos(wz * 0.038 - 0.2) * 0.01;
      const h = 0.7 + ripple;
      terrain.heights[idx] = h;
      terrain.baseHeights[idx] = h;
    }
  }

  stampTrackCorridor(terrain, segments, 5.2, 0.715);
  stampCirclePad(
    terrain,
    DUMP_TRUCK.groupX,
    DUMP_TRUCK.groupZ,
    10,
    0.71,
    0.9,
  );
  stampCirclePad(terrain, crash[0], crash[1], 16, 0.72, 0.85);
  stampCirclePad(terrain, hill[0], hill[1], 18, 0.78, 0.55);
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
