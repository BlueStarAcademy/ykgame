import type { AttachmentType } from "@/games/yanmar/types";

export const PLAYER_UNLOCKS = {
  BREAKER: 10,
  GRAPPLE: 15,
} as const;

export type PlayerUnlockKind = keyof typeof PLAYER_UNLOCKS;

export function getAttachmentRequiredLevel(type: AttachmentType): number {
  if (type === "breaker") return PLAYER_UNLOCKS.BREAKER;
  if (type === "grapple") return PLAYER_UNLOCKS.GRAPPLE;
  return 1;
}

export function isAttachmentUnlocked(type: AttachmentType, playerLevel: number): boolean {
  return playerLevel >= getAttachmentRequiredLevel(type);
}

export function getCrossedUnlocks(previousLevel: number, nextLevel: number): PlayerUnlockKind[] {
  return (Object.keys(PLAYER_UNLOCKS) as PlayerUnlockKind[]).filter((kind) => {
    const required = PLAYER_UNLOCKS[kind];
    return previousLevel < required && nextLevel >= required;
  });
}
