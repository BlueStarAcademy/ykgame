import { getSeasonKey } from "@/lib/games";
import type { ExcavatorSimState } from "./types";
import {
  createDumpTruckState,
  fastForwardDumpTruckState,
  type DumpTruckPhase,
  type DumpTruckRuntimeState,
} from "./dumpTruckState";
import {
  cloneDigZones,
  createTerrain,
  flattenStoneZoneHeights,
  updateDigZoneRespawns,
  fastForwardHaulTruckState,
  HAUL_TRUCK_COOLDOWN_SEC,
  normalizeCrashZone,
  type DigZone,
  type CrashZone,
  type HillZone,
  type TerrainData,
} from "./terrain";
import type { MapTier } from "./mapTier";

const STORAGE_PREFIX = "ykgame:yanmar:game-session:v1";
const SNAPSHOT_VERSION = 3;

function normalizeHillZone(zone: HillZone): HillZone {
  return {
    ...zone,
    active: typeof zone.active === "boolean" ? zone.active : true,
    clearedAt: zone.clearedAt ?? null,
    respawnAt: zone.respawnAt ?? null,
    boulders: zone.boulders.map((rock, index) => {
      const size =
        typeof rock.size === "number" && Number.isFinite(rock.size)
          ? rock.size
          : (index % 5) / 4;
      const roundness =
        typeof rock.roundness === "number" && Number.isFinite(rock.roundness)
          ? rock.roundness
          : index % 2;
      const comOffsetX =
        typeof rock.comOffsetX === "number" && Number.isFinite(rock.comOffsetX)
          ? rock.comOffsetX
          : (((index * 17) % 7) / 7) * 0.35 - 0.175;
      const comOffsetZ =
        typeof rock.comOffsetZ === "number" && Number.isFinite(rock.comOffsetZ)
          ? rock.comOffsetZ
          : (((index * 29) % 7) / 7) * 0.35 - 0.175;
      return {
        ...rock,
        size,
        roundness,
        comOffsetX,
        comOffsetZ,
        extracted:
          typeof rock.extracted === "boolean"
            ? rock.extracted
            : Boolean(rock.delivered),
      };
    }),
    haulTruck: { ...zone.haulTruck },
  };
}

export interface YanmarGameSessionSnapshot {
  version: 2 | 3;
  seasonKey: string;
  savedAtMs: number;
  sim: ExcavatorSimState;
  dumpTruck: DumpTruckRuntimeState;
  dumpTruckCooldownSec: number;
  haulTruckCooldownSec?: number;
  digZones: DigZone[];
  crashZone: CrashZone | null;
  hillZone: HillZone | null;
  mapTier: MapTier;
  gridSizeX: number;
  gridSizeZ: number;
  heights: number[];
  baseHeights: number[];
  arcadeScore: number;
  dumped: number;
  rewardStars: number;
}

const VALID_PHASES = new Set<DumpTruckPhase>([
  "ready",
  "engineStart",
  "departing",
  "cooldown",
  "arriving",
]);

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidSim(value: unknown): value is ExcavatorSimState {
  if (!value || typeof value !== "object") return false;
  const sim = value as Partial<ExcavatorSimState>;
  return (
    isFiniteNumber(sim.swing) &&
    isFiniteNumber(sim.boom) &&
    isFiniteNumber(sim.arm) &&
    isFiniteNumber(sim.bucket) &&
    isFiniteNumber(sim.posX) &&
    isFiniteNumber(sim.posY) &&
    isFiniteNumber(sim.posZ) &&
    isFiniteNumber(sim.heading) &&
    isFiniteNumber(sim.bucketLoad) &&
    (sim.attachmentType === "bucket" ||
      sim.attachmentType === "breaker" ||
      sim.attachmentType === "grapple") &&
    (sim.carriedBoulderId === null || typeof sim.carriedBoulderId === "string")
  );
}

function isValidDigZone(value: unknown): value is DigZone {
  if (!value || typeof value !== "object") return false;
  const zone = value as Partial<DigZone>;
  return (
    typeof zone.id === "string" &&
    isFiniteNumber(zone.x) &&
    isFiniteNumber(zone.z) &&
    isFiniteNumber(zone.radius) &&
    isFiniteNumber(zone.capacityUnits) &&
    isFiniteNumber(zone.remainingUnits) &&
    typeof zone.active === "boolean" &&
    (zone.depletedAt === null || isFiniteNumber(zone.depletedAt)) &&
    (zone.respawnAt === null || isFiniteNumber(zone.respawnAt))
  );
}

function isValidDumpTruck(value: unknown): value is DumpTruckRuntimeState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<DumpTruckRuntimeState>;
  return (
    VALID_PHASES.has(state.phase as DumpTruckPhase) &&
    isFiniteNumber(state.fillUnits) &&
    isFiniteNumber(state.cooldownRemaining) &&
    isFiniteNumber(state.offsetLocalX) &&
    isFiniteNumber(state.rotationYOffset) &&
    isFiniteNumber(state.phaseElapsed)
  );
}

function isValidSnapshot(value: unknown): value is YanmarGameSessionSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<YanmarGameSessionSnapshot>;
  return (
    (snapshot.version === 2 || snapshot.version === SNAPSHOT_VERSION) &&
    typeof snapshot.seasonKey === "string" &&
    isFiniteNumber(snapshot.savedAtMs) &&
    isValidSim(snapshot.sim) &&
    isValidDumpTruck(snapshot.dumpTruck) &&
    isFiniteNumber(snapshot.dumpTruckCooldownSec) &&
    (snapshot.haulTruckCooldownSec === undefined ||
      isFiniteNumber(snapshot.haulTruckCooldownSec)) &&
    Array.isArray(snapshot.digZones) &&
    snapshot.digZones.every(isValidDigZone) &&
    (snapshot.mapTier === 1 || snapshot.mapTier === 2 || snapshot.mapTier === 3) &&
    isFiniteNumber(snapshot.gridSizeX) &&
    isFiniteNumber(snapshot.gridSizeZ) &&
    Array.isArray(snapshot.heights) &&
    Array.isArray(snapshot.baseHeights) &&
    snapshot.heights.length === snapshot.baseHeights.length &&
    snapshot.heights.every(isFiniteNumber) &&
    snapshot.baseHeights.every(isFiniteNumber) &&
    isFiniteNumber(snapshot.arcadeScore) &&
    isFiniteNumber(snapshot.dumped) &&
    isFiniteNumber(snapshot.rewardStars)
  );
}

export function clearYanmarGameSession(userId: string) {
  try {
    window.localStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
}

/**
 * DB에 반영된 점수를 로컬 세션의 미저장 점수에서 제거한다.
 * 지형과 장비 상태는 유지해 재입장 시 이어서 플레이할 수 있게 한다.
 */
export function commitYanmarGameSessionScore(userId: string, committedScore: number) {
  if (!Number.isFinite(committedScore) || committedScore < 0) return;

  try {
    const key = storageKey(userId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return;

    const parsed: unknown = JSON.parse(raw);
    if (!isValidSnapshot(parsed)) {
      window.localStorage.removeItem(key);
      return;
    }

    window.localStorage.setItem(
      key,
      JSON.stringify({
        ...parsed,
        arcadeScore: Math.max(0, parsed.arcadeScore - committedScore),
      } satisfies YanmarGameSessionSnapshot),
    );
  } catch {
    // 저장 공간이 차단되더라도 서버의 점수 저장 결과는 유지한다.
  }
}

export function saveYanmarGameSession(
  userId: string,
  snapshot: Omit<YanmarGameSessionSnapshot, "version" | "seasonKey" | "savedAtMs">,
  nowMs = Date.now(),
) {
  try {
    const payload: YanmarGameSessionSnapshot = {
      version: SNAPSHOT_VERSION,
      seasonKey: getSeasonKey(new Date(nowMs)),
      savedAtMs: nowMs,
      sim: { ...snapshot.sim },
      dumpTruck: { ...snapshot.dumpTruck },
      dumpTruckCooldownSec: snapshot.dumpTruckCooldownSec,
      haulTruckCooldownSec: snapshot.haulTruckCooldownSec,
      digZones: cloneDigZones(snapshot.digZones),
      crashZone: snapshot.crashZone
        ? normalizeCrashZone({
            ...snapshot.crashZone,
            tiles: snapshot.crashZone.tiles.map((tile) => ({ ...tile })),
          })
        : null,
      hillZone: snapshot.hillZone ? normalizeHillZone(snapshot.hillZone) : null,
      mapTier: snapshot.mapTier,
      gridSizeX: snapshot.gridSizeX,
      gridSizeZ: snapshot.gridSizeZ,
      heights: Array.from(snapshot.heights),
      baseHeights: Array.from(snapshot.baseHeights),
      arcadeScore: snapshot.arcadeScore,
      dumped: snapshot.dumped,
      rewardStars: snapshot.rewardStars,
    };
    window.localStorage.setItem(storageKey(userId), JSON.stringify(payload));
  } catch {
    // 저장 공간이 차단되더라도 게임 진행은 유지한다.
  }
}

export function loadYanmarGameSession(
  userId: string,
  nowMs = Date.now(),
): YanmarGameSessionSnapshot | null {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isValidSnapshot(parsed)) {
      window.localStorage.removeItem(storageKey(userId));
      return null;
    }

    const seasonKey = getSeasonKey(new Date(nowMs));
    if (parsed.seasonKey !== seasonKey) {
      window.localStorage.removeItem(storageKey(userId));
      return null;
    }

    const dumpTruck = createDumpTruckState();
    Object.assign(dumpTruck, parsed.dumpTruck);
    const elapsedSec = Math.max(0, nowMs - parsed.savedAtMs) / 1000;
    fastForwardDumpTruckState(
      dumpTruck,
      elapsedSec,
      parsed.dumpTruckCooldownSec,
    );

    const haulTruckCooldownSec =
      parsed.haulTruckCooldownSec ?? HAUL_TRUCK_COOLDOWN_SEC;
    const hillZone = parsed.hillZone ? normalizeHillZone(parsed.hillZone) : null;
    if (hillZone?.haulTruck) {
      fastForwardHaulTruckState(
        hillZone.haulTruck,
        elapsedSec,
        haulTruckCooldownSec,
      );
    }

    return {
      ...parsed,
      version: SNAPSHOT_VERSION,
      sim: { ...parsed.sim },
      dumpTruck,
      haulTruckCooldownSec,
      digZones: cloneDigZones(parsed.digZones),
      crashZone: parsed.crashZone
        ? normalizeCrashZone({
            ...parsed.crashZone,
            tiles: parsed.crashZone.tiles.map((tile) => ({ ...tile })),
          })
        : null,
      hillZone,
      heights: [...parsed.heights],
      baseHeights: [...parsed.baseHeights],
    };
  } catch {
    return null;
  }
}

export function applyGameSessionTerrain(
  snapshot: Pick<
    YanmarGameSessionSnapshot,
    | "digZones"
    | "heights"
    | "baseHeights"
    | "crashZone"
    | "hillZone"
    | "mapTier"
    | "gridSizeX"
    | "gridSizeZ"
  >,
  nowMs = Date.now(),
): TerrainData {
  const levelForTier = snapshot.mapTier === 3 ? 15 : snapshot.mapTier === 2 ? 10 : 1;
  const terrain = createTerrain(-48, -48, true, levelForTier);
  terrain.digZones = cloneDigZones(snapshot.digZones);
  terrain.crashZone = snapshot.crashZone
    ? normalizeCrashZone({
        ...snapshot.crashZone,
        tiles: snapshot.crashZone.tiles.map((tile) => ({ ...tile })),
      })
    : null;
  terrain.hillZone = snapshot.hillZone
    ? normalizeHillZone(snapshot.hillZone)
    : null;
  if (
    snapshot.heights.length === terrain.heights.length &&
    snapshot.baseHeights.length === terrain.baseHeights.length
  ) {
    terrain.heights.set(snapshot.heights);
    terrain.baseHeights.set(snapshot.baseHeights);
  }
  flattenStoneZoneHeights(terrain);
  updateDigZoneRespawns(terrain, nowMs);
  return terrain;
}
