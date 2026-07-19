import {
  getWorldPickupHourBucket,
  type WorldPickup,
  type WorldPickupKind,
  type WorldPickupsState,
} from "./worldPickups";

const STORAGE_PREFIX = "ykgame:yanmar:world-pickups:v1";
const SNAPSHOT_VERSION = 1;

export interface WorldPickupPersistSnapshot {
  version: typeof SNAPSHOT_VERSION;
  savedAtMs: number;
  hourBucket: number;
  starCollectedThisHour: number;
  speedCollectedThisHour: number;
  pendingStarAt: number[];
  pendingSpeedAt: number[];
  speedBuffUntilMs: number;
  active: Array<{
    id: string;
    kind: WorldPickupKind;
    x: number;
    z: number;
    spawnedAt: number;
  }>;
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPickupKind(value: unknown): value is WorldPickupKind {
  return value === "star" || value === "speed";
}

function sanitizeNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isFiniteNumber).sort((a, b) => a - b);
}

function sanitizeActive(value: unknown): WorldPickupPersistSnapshot["active"] {
  if (!Array.isArray(value)) return [];
  const out: WorldPickupPersistSnapshot["active"] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      !isPickupKind(row.kind) ||
      !isFiniteNumber(row.x) ||
      !isFiniteNumber(row.z) ||
      !isFiniteNumber(row.spawnedAt)
    ) {
      continue;
    }
    out.push({
      id: row.id,
      kind: row.kind,
      x: row.x,
      z: row.z,
      spawnedAt: row.spawnedAt,
    });
  }
  return out;
}

function isValidSnapshot(value: unknown): value is WorldPickupPersistSnapshot {
  if (!value || typeof value !== "object") return false;
  const snap = value as Partial<WorldPickupPersistSnapshot>;
  return (
    snap.version === SNAPSHOT_VERSION &&
    isFiniteNumber(snap.savedAtMs) &&
    isFiniteNumber(snap.hourBucket) &&
    isFiniteNumber(snap.starCollectedThisHour) &&
    isFiniteNumber(snap.speedCollectedThisHour) &&
    isFiniteNumber(snap.speedBuffUntilMs) &&
    Array.isArray(snap.pendingStarAt) &&
    Array.isArray(snap.pendingSpeedAt) &&
    Array.isArray(snap.active)
  );
}

export function loadWorldPickupSnapshot(
  userId: string | null | undefined,
): WorldPickupPersistSnapshot | null {
  if (typeof window === "undefined") return null;
  const id = userId?.trim();
  if (!id) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSnapshot(parsed)) {
      window.localStorage.removeItem(storageKey(id));
      return null;
    }
    return {
      ...parsed,
      pendingStarAt: sanitizeNumberArray(parsed.pendingStarAt),
      pendingSpeedAt: sanitizeNumberArray(parsed.pendingSpeedAt),
      active: sanitizeActive(parsed.active),
      starCollectedThisHour: Math.max(0, Math.floor(parsed.starCollectedThisHour)),
      speedCollectedThisHour: Math.max(0, Math.floor(parsed.speedCollectedThisHour)),
    };
  } catch {
    return null;
  }
}

export function saveWorldPickupSnapshot(
  userId: string | null | undefined,
  state: WorldPickupsState,
  now = Date.now(),
) {
  if (typeof window === "undefined") return;
  const id = userId?.trim();
  if (!id) return;
  const snapshot: WorldPickupPersistSnapshot = {
    version: SNAPSHOT_VERSION,
    savedAtMs: now,
    hourBucket: state.hourBucket,
    starCollectedThisHour: state.starCollectedThisHour,
    speedCollectedThisHour: state.speedCollectedThisHour,
    pendingStarAt: [...state.pendingStarAt],
    pendingSpeedAt: [...state.pendingSpeedAt],
    speedBuffUntilMs: state.speedBuffUntilMs,
    active: state.active.map((p) => ({
      id: p.id,
      kind: p.kind,
      x: p.x,
      z: p.z,
      spawnedAt: p.spawnedAt,
    })),
  };
  try {
    window.localStorage.setItem(storageKey(id), JSON.stringify(snapshot));
  } catch {
    // quota / private mode
  }
}

export function snapshotToActivePickups(
  snapshot: WorldPickupPersistSnapshot,
): WorldPickup[] {
  return snapshot.active.map((p) => ({
    id: p.id,
    kind: p.kind,
    x: p.x,
    y: 0,
    z: p.z,
    spawnedAt: p.spawnedAt,
  }));
}

/** True when a saved snapshot still applies to the current KST hour. */
export function isWorldPickupSnapshotCurrent(
  snapshot: WorldPickupPersistSnapshot,
  now = Date.now(),
) {
  return snapshot.hourBucket === getWorldPickupHourBucket(now);
}
