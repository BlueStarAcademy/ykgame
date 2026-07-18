import type { AttachmentType } from "@/games/yanmar/types";

export const PLAYER_UNLOCKS = {
  BREAKER: 10,
  GRAPPLE: 15,
} as const;

/** 연습·튜토리얼에서 맵/부착물을 전부 열 때 쓰는 유효 레벨 */
export const PRACTICE_FULL_UNLOCK_LEVEL = PLAYER_UNLOCKS.GRAPPLE;

export type PlayerUnlockKind = keyof typeof PLAYER_UNLOCKS;

export function getAttachmentRequiredLevel(type: AttachmentType): number {
  if (type === "breaker") return PLAYER_UNLOCKS.BREAKER;
  if (type === "grapple") return PLAYER_UNLOCKS.GRAPPLE;
  return 1;
}

export function isAttachmentUnlocked(
  type: AttachmentType,
  playerLevel: number,
  opts?: { unlockAll?: boolean },
): boolean {
  if (opts?.unlockAll) return true;
  return playerLevel >= getAttachmentRequiredLevel(type);
}

/** 장비 강화 모달 부착물 탭 (버켓은 항상 개방) */
export function isUpgradeAttachmentTabUnlocked(
  tab: AttachmentType,
  playerLevel: number,
  opts?: { unlockAll?: boolean },
): boolean {
  if (tab === "bucket") return true;
  return isAttachmentUnlocked(tab, playerLevel, opts);
}

/** 브레이커/집게(돌트럭 포함) 강화 파츠 잠금 여부 */
export function isYanmarEquipmentPartLocked(
  part: string,
  playerLevel: number,
): boolean {
  if (part === "CRASH_RESPAWN") return playerLevel < PLAYER_UNLOCKS.BREAKER;
  if (
    part === "GRAPPLE_ADHESION" ||
    part === "HAUL_TRUCK_SPEED" ||
    part === "HILL_SAFE_LOAD"
  ) {
    return playerLevel < PLAYER_UNLOCKS.GRAPPLE;
  }
  return false;
}

export function getCrossedUnlocks(
  previousLevel: number,
  nextLevel: number,
): PlayerUnlockKind[] {
  return (Object.keys(PLAYER_UNLOCKS) as PlayerUnlockKind[]).filter((kind) => {
    const required = PLAYER_UNLOCKS[kind];
    return previousLevel < required && nextLevel >= required;
  });
}

const UNLOCK_SEEN_PREFIX = "ykgame:yanmar:unlock-seen";
/** Device-wide map — survives user-id timing races ("local" vs session id). */
const UNLOCK_SEEN_MAP_KEY = `${UNLOCK_SEEN_PREFIX}:v3-map`;

type UnlockSeenMap = Partial<Record<PlayerUnlockKind, true>>;

function readUnlockSeenMap(): UnlockSeenMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(UNLOCK_SEEN_MAP_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: UnlockSeenMap = {};
    for (const kind of Object.keys(PLAYER_UNLOCKS) as PlayerUnlockKind[]) {
      if ((parsed as Record<string, unknown>)[kind] === true) {
        out[kind] = true;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeUnlockSeenMap(map: UnlockSeenMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UNLOCK_SEEN_MAP_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / private mode
  }
}

function unlockSeenStorageKeys(
  ownerId: string,
  kind: PlayerUnlockKind,
): string[] {
  return [
    `${UNLOCK_SEEN_PREFIX}:v2:${ownerId}:${kind}`,
    // Legacy key (pre user-scoped). Kept for migration / dual-write.
    `${UNLOCK_SEEN_PREFIX}:${kind}`,
  ];
}

export function hasSeenPlayerUnlock(
  ownerId: string,
  kind: PlayerUnlockKind,
): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (readUnlockSeenMap()[kind]) return true;
    const legacySeen = unlockSeenStorageKeys(ownerId, kind).some(
      (key) => window.localStorage.getItem(key) === "1",
    );
    if (!legacySeen) return false;
    // Promote legacy flags into the device-wide map.
    const map = readUnlockSeenMap();
    map[kind] = true;
    writeUnlockSeenMap(map);
    return true;
  } catch {
    return false;
  }
}

/** Persist that the unlock modal was shown so it never reappears on reconnect. */
export function markPlayerUnlockSeen(
  ownerId: string,
  kind: PlayerUnlockKind,
): void {
  if (typeof window === "undefined") return;
  try {
    const map = readUnlockSeenMap();
    map[kind] = true;
    writeUnlockSeenMap(map);

    const owners = new Set<string>([ownerId, "local"]);
    for (const owner of owners) {
      for (const key of unlockSeenStorageKeys(owner, kind)) {
        window.localStorage.setItem(key, "1");
      }
    }
  } catch {
    // Storage may be blocked; in-memory guards still prevent same-session repeats.
  }
}

export function getUnseenUnlocksForLevel(
  ownerId: string,
  level: number,
): PlayerUnlockKind[] {
  return (Object.keys(PLAYER_UNLOCKS) as PlayerUnlockKind[]).filter((kind) => {
    return level >= PLAYER_UNLOCKS[kind] && !hasSeenPlayerUnlock(ownerId, kind);
  });
}
