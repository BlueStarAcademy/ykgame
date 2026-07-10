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
