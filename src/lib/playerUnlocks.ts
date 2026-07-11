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

export function getCrossedUnlocks(previousLevel: number, nextLevel: number): PlayerUnlockKind[] {
  return (Object.keys(PLAYER_UNLOCKS) as PlayerUnlockKind[]).filter((kind) => {
    const required = PLAYER_UNLOCKS[kind];
    return previousLevel < required && nextLevel >= required;
  });
}

const UNLOCK_SEEN_PREFIX = "ykgame:yanmar:unlock-seen";

function unlockSeenStorageKeys(ownerId: string, kind: PlayerUnlockKind): string[] {
  return [
    `${UNLOCK_SEEN_PREFIX}:v2:${ownerId}:${kind}`,
    // Legacy key (pre user-scoped). Kept for migration / dual-write.
    `${UNLOCK_SEEN_PREFIX}:${kind}`,
  ];
}

export function hasSeenPlayerUnlock(ownerId: string, kind: PlayerUnlockKind): boolean {
  if (typeof window === "undefined") return false;
  try {
    return unlockSeenStorageKeys(ownerId, kind).some(
      (key) => window.localStorage.getItem(key) === "1",
    );
  } catch {
    return false;
  }
}

/** Persist that the unlock modal was shown so it never reappears on reconnect. */
export function markPlayerUnlockSeen(ownerId: string, kind: PlayerUnlockKind): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of unlockSeenStorageKeys(ownerId, kind)) {
      window.localStorage.setItem(key, "1");
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
