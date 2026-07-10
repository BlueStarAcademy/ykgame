import type { AutoPoseSlotIndex, SavedArmPose } from "./types";
import { AUTO_POSE_SLOT_COUNT } from "./types";

const STORAGE_PREFIX = "ykgame:yanmar:auto-pose:v2";
const LEGACY_STORAGE_PREFIX = "ykgame:yanmar:auto-pose:v1";
const SNAPSHOT_VERSION = 2;

/** 비로그인·세션 대기 중에도 같은 브라우저에서 자세를 유지한다. */
export const AUTO_POSE_LOCAL_OWNER = "local";

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

function storageKey(ownerId: string) {
  return `${STORAGE_PREFIX}:${ownerId}`;
}

function legacyStorageKey(ownerId: string) {
  return `${LEGACY_STORAGE_PREFIX}:${ownerId}`;
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

function hasAnySlot(slots: AutoPoseSlots): boolean {
  return slots[0] != null || slots[1] != null;
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

function migrateLegacySlots(ownerId: string): AutoPoseSlots | null {
  try {
    const raw = window.localStorage.getItem(legacyStorageKey(ownerId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSnapshotV1(parsed)) {
      window.localStorage.removeItem(legacyStorageKey(ownerId));
      return null;
    }
    const slots: AutoPoseSlots = [{ ...parsed.pose }, null];
    saveSavedArmPoseSlots(ownerId, slots, parsed.savedAtMs);
    window.localStorage.removeItem(legacyStorageKey(ownerId));
    return slots;
  } catch {
    return null;
  }
}

/** 로그인 사용자는 userId, 아니면 브라우저 로컬 키. */
export function resolveAutoPoseStorageOwner(userId?: string | null): string {
  return userId?.trim() ? userId : AUTO_POSE_LOCAL_OWNER;
}

export function loadSavedArmPoseSlots(ownerId: string): AutoPoseSlots {
  try {
    const raw = window.localStorage.getItem(storageKey(ownerId));
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidSnapshotV2(parsed)) {
        return normalizeSlots(parsed.slots);
      }
      window.localStorage.removeItem(storageKey(ownerId));
    }
    return migrateLegacySlots(ownerId) ?? emptySlots();
  } catch {
    return emptySlots();
  }
}

/**
 * 로그인 시 사용자 슬롯을 우선하고, 비어 있으면 로컬(게스트) 슬롯을 이어받는다.
 */
export function loadAutoPoseSlotsForSession(userId?: string | null): AutoPoseSlots {
  const ownerId = resolveAutoPoseStorageOwner(userId);
  const owned = loadSavedArmPoseSlots(ownerId);
  if (hasAnySlot(owned) || ownerId === AUTO_POSE_LOCAL_OWNER) {
    return owned;
  }

  const local = loadSavedArmPoseSlots(AUTO_POSE_LOCAL_OWNER);
  if (!hasAnySlot(local)) return owned;

  saveSavedArmPoseSlots(ownerId, local);
  return local;
}

/** @deprecated 단일 슬롯 호환 — 슬롯 0만 반환 */
export function loadSavedArmPose(ownerId: string): SavedArmPose | null {
  return loadSavedArmPoseSlots(ownerId)[0];
}

export function saveSavedArmPoseSlots(
  ownerId: string,
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
    window.localStorage.setItem(storageKey(ownerId), JSON.stringify(payload));
  } catch {
    // 저장 공간이 차단되더라도 게임 진행은 유지한다.
  }
}

export function saveSavedArmPoseSlot(
  ownerId: string,
  slot: AutoPoseSlotIndex,
  pose: SavedArmPose,
  nowMs = Date.now(),
) {
  const slots = loadSavedArmPoseSlots(ownerId);
  slots[slot] = { ...pose };
  saveSavedArmPoseSlots(ownerId, slots, nowMs);
}

/** @deprecated 단일 슬롯 호환 — 슬롯 0에 저장 */
export function saveSavedArmPose(ownerId: string, pose: SavedArmPose, nowMs = Date.now()) {
  saveSavedArmPoseSlot(ownerId, 0, pose, nowMs);
}

export function clearSavedArmPose(ownerId: string) {
  try {
    window.localStorage.removeItem(storageKey(ownerId));
    window.localStorage.removeItem(legacyStorageKey(ownerId));
  } catch {
    // ignore
  }
}
