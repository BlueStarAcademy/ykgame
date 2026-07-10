import type { AutoPoseSlotIndex, SavedArmPose } from "./types";
import { AUTO_POSE_SLOT_COUNT } from "./types";

const STORAGE_PREFIX = "ykgame:yanmar:auto-pose:v2";
const LEGACY_STORAGE_PREFIX = "ykgame:yanmar:auto-pose:v1";
const SNAPSHOT_VERSION = 2;

export type AutoPoseSlots = [SavedArmPose | null, SavedArmPose | null];

interface AutoPoseSnapshotV2 {
  version: typeof SNAPSHOT_VERSION;
  savedAtMs: number;
  slots: AutoPoseSlots;
}

interface AutoPoseSnapshotV1 {
  version: 1;
  savedAtMs: number;
  pose: SavedArmPose;
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

function legacyStorageKey(userId: string) {
  return `${LEGACY_STORAGE_PREFIX}:${userId}`;
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

function emptySlots(): AutoPoseSlots {
  return [null, null];
}

function normalizeSlots(value: unknown): AutoPoseSlots {
  if (!Array.isArray(value)) return emptySlots();
  const slots = emptySlots();
  for (let i = 0; i < AUTO_POSE_SLOT_COUNT; i++) {
    slots[i] = isValidPose(value[i]) ? { ...value[i] } : null;
  }
  return slots;
}

function isValidSnapshotV2(value: unknown): value is AutoPoseSnapshotV2 {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<AutoPoseSnapshotV2>;
  return (
    snapshot.version === SNAPSHOT_VERSION &&
    isFiniteNumber(snapshot.savedAtMs) &&
    Array.isArray(snapshot.slots)
  );
}

function isValidSnapshotV1(value: unknown): value is AutoPoseSnapshotV1 {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<AutoPoseSnapshotV1>;
  return (
    snapshot.version === 1 &&
    isFiniteNumber(snapshot.savedAtMs) &&
    isValidPose(snapshot.pose)
  );
}

function migrateLegacySlots(userId: string): AutoPoseSlots | null {
  try {
    const raw = window.localStorage.getItem(legacyStorageKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSnapshotV1(parsed)) {
      window.localStorage.removeItem(legacyStorageKey(userId));
      return null;
    }
    const slots: AutoPoseSlots = [{ ...parsed.pose }, null];
    saveSavedArmPoseSlots(userId, slots, parsed.savedAtMs);
    window.localStorage.removeItem(legacyStorageKey(userId));
    return slots;
  } catch {
    return null;
  }
}

export function loadSavedArmPoseSlots(userId: string): AutoPoseSlots {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidSnapshotV2(parsed)) {
        return normalizeSlots(parsed.slots);
      }
      window.localStorage.removeItem(storageKey(userId));
    }
    return migrateLegacySlots(userId) ?? emptySlots();
  } catch {
    return emptySlots();
  }
}

/** @deprecated 단일 슬롯 호환 — 슬롯 0만 반환 */
export function loadSavedArmPose(userId: string): SavedArmPose | null {
  return loadSavedArmPoseSlots(userId)[0];
}

export function saveSavedArmPoseSlots(
  userId: string,
  slots: AutoPoseSlots,
  nowMs = Date.now(),
) {
  try {
    const payload: AutoPoseSnapshotV2 = {
      version: SNAPSHOT_VERSION,
      savedAtMs: nowMs,
      slots: [
        slots[0] ? { ...slots[0] } : null,
        slots[1] ? { ...slots[1] } : null,
      ],
    };
    window.localStorage.setItem(storageKey(userId), JSON.stringify(payload));
  } catch {
    // 저장 공간이 차단되더라도 게임 진행은 유지한다.
  }
}

export function saveSavedArmPoseSlot(
  userId: string,
  slot: AutoPoseSlotIndex,
  pose: SavedArmPose,
  nowMs = Date.now(),
) {
  const slots = loadSavedArmPoseSlots(userId);
  slots[slot] = { ...pose };
  saveSavedArmPoseSlots(userId, slots, nowMs);
}

/** @deprecated 단일 슬롯 호환 — 슬롯 0에 저장 */
export function saveSavedArmPose(userId: string, pose: SavedArmPose, nowMs = Date.now()) {
  saveSavedArmPoseSlot(userId, 0, pose, nowMs);
}

export function clearSavedArmPose(userId: string) {
  try {
    window.localStorage.removeItem(storageKey(userId));
    window.localStorage.removeItem(legacyStorageKey(userId));
  } catch {
    // ignore
  }
}
