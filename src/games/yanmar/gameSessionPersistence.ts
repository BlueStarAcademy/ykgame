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
  updateDigZoneRespawns,
  type DigZone,
  type TerrainData,
} from "./terrain";

const STORAGE_PREFIX = "ykgame:yanmar:game-session:v1";
const SNAPSHOT_VERSION = 1;

export interface YanmarGameSessionSnapshot {
  version: typeof SNAPSHOT_VERSION;
  seasonKey: string;
  savedAtMs: number;
  sim: ExcavatorSimState;
  dumpTruck: DumpTruckRuntimeState;
  dumpTruckCooldownSec: number;
  digZones: DigZone[];
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
    isFiniteNumber(sim.posZ) &&
    isFiniteNumber(sim.heading) &&
    isFiniteNumber(sim.bucketLoad)
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
    snapshot.version === SNAPSHOT_VERSION &&
    typeof snapshot.seasonKey === "string" &&
    isFiniteNumber(snapshot.savedAtMs) &&
    isValidSim(snapshot.sim) &&
    isValidDumpTruck(snapshot.dumpTruck) &&
    isFiniteNumber(snapshot.dumpTruckCooldownSec) &&
    Array.isArray(snapshot.digZones) &&
    snapshot.digZones.every(isValidDigZone) &&
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
      digZones: cloneDigZones(snapshot.digZones),
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
    fastForwardDumpTruckState(
      dumpTruck,
      Math.max(0, nowMs - parsed.savedAtMs) / 1000,
      parsed.dumpTruckCooldownSec,
    );

    return {
      ...parsed,
      sim: { ...parsed.sim },
      dumpTruck,
      digZones: cloneDigZones(parsed.digZones),
      heights: [...parsed.heights],
      baseHeights: [...parsed.baseHeights],
    };
  } catch {
    return null;
  }
}

export function applyGameSessionTerrain(
  snapshot: Pick<YanmarGameSessionSnapshot, "digZones" | "heights" | "baseHeights">,
  nowMs = Date.now(),
): TerrainData {
  const terrain = createTerrain(-48, -48, true);
  terrain.digZones = cloneDigZones(snapshot.digZones);
  if (
    snapshot.heights.length === terrain.heights.length &&
    snapshot.baseHeights.length === terrain.baseHeights.length
  ) {
    terrain.heights.set(snapshot.heights);
    terrain.baseHeights.set(snapshot.baseHeights);
  }
  updateDigZoneRespawns(terrain, nowMs);
  return terrain;
}
