import {
  createDumpTruckState,
  fastForwardDumpTruckState,
  type DumpTruckPhase,
  type DumpTruckRuntimeState,
} from "./dumpTruckState";

const STORAGE_PREFIX = "ykgame:yanmar:dump-truck:v1";
const SNAPSHOT_VERSION = 1;

interface DumpTruckSnapshot {
  version: typeof SNAPSHOT_VERSION;
  savedAtMs: number;
  cooldownSec: number;
  state: DumpTruckRuntimeState;
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

function isValidSnapshot(value: unknown): value is DumpTruckSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<DumpTruckSnapshot>;
  const state = snapshot.state as Partial<DumpTruckRuntimeState> | undefined;

  return (
    snapshot.version === SNAPSHOT_VERSION &&
    isFiniteNumber(snapshot.savedAtMs) &&
    isFiniteNumber(snapshot.cooldownSec) &&
    snapshot.cooldownSec >= 0 &&
    !!state &&
    VALID_PHASES.has(state.phase as DumpTruckPhase) &&
    isFiniteNumber(state.fillUnits) &&
    isFiniteNumber(state.cooldownRemaining) &&
    isFiniteNumber(state.offsetLocalX) &&
    isFiniteNumber(state.rotationYOffset) &&
    isFiniteNumber(state.phaseElapsed)
  );
}

export function loadDumpTruckCooldown(
  userId: string,
  nowMs = Date.now(),
): DumpTruckRuntimeState | null {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isValidSnapshot(parsed)) {
      window.localStorage.removeItem(storageKey(userId));
      return null;
    }

    const state = createDumpTruckState();
    Object.assign(state, parsed.state);
    fastForwardDumpTruckState(
      state,
      Math.max(0, nowMs - parsed.savedAtMs) / 1000,
      parsed.cooldownSec,
    );

    if (state.phase === "ready") {
      window.localStorage.removeItem(storageKey(userId));
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

export function saveDumpTruckCooldown(
  userId: string,
  state: DumpTruckRuntimeState,
  cooldownSec: number,
  nowMs = Date.now(),
) {
  try {
    if (state.phase === "ready") {
      window.localStorage.removeItem(storageKey(userId));
      return;
    }

    const snapshot: DumpTruckSnapshot = {
      version: SNAPSHOT_VERSION,
      savedAtMs: nowMs,
      cooldownSec,
      state: { ...state },
    };
    window.localStorage.setItem(storageKey(userId), JSON.stringify(snapshot));
  } catch {
    // 저장 공간이 차단되더라도 게임 진행은 유지한다.
  }
}
