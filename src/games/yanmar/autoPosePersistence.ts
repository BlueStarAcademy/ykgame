import type { SavedArmPose } from "./types";

const STORAGE_PREFIX = "ykgame:yanmar:auto-pose:v1";
const SNAPSHOT_VERSION = 1;

interface AutoPoseSnapshot {
  version: typeof SNAPSHOT_VERSION;
  savedAtMs: number;
  pose: SavedArmPose;
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidPose(value: unknown): value is SavedArmPose {
  if (!value || typeof value !== "object") return false;
  const pose = value as Partial<SavedArmPose>;
  return (
    isFiniteNumber(pose.boom) &&
    isFiniteNumber(pose.arm) &&
    isFiniteNumber(pose.bucket)
  );
}

function isValidSnapshot(value: unknown): value is AutoPoseSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<AutoPoseSnapshot>;
  return (
    snapshot.version === SNAPSHOT_VERSION &&
    isFiniteNumber(snapshot.savedAtMs) &&
    isValidPose(snapshot.pose)
  );
}

export function loadSavedArmPose(userId: string): SavedArmPose | null {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isValidSnapshot(parsed)) {
      window.localStorage.removeItem(storageKey(userId));
      return null;
    }

    return { ...parsed.pose };
  } catch {
    return null;
  }
}

export function saveSavedArmPose(userId: string, pose: SavedArmPose, nowMs = Date.now()) {
  try {
    const payload: AutoPoseSnapshot = {
      version: SNAPSHOT_VERSION,
      savedAtMs: nowMs,
      pose: { ...pose },
    };
    window.localStorage.setItem(storageKey(userId), JSON.stringify(payload));
  } catch {
    // 저장 공간이 차단되더라도 게임 진행은 유지한다.
  }
}

export function clearSavedArmPose(userId: string) {
  try {
    window.localStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
}
