/** Base XP required to go from level 1 → 2. */
export const PLAYER_BASE_LEVEL_XP = 1000;

/** Growth applied when computing cost to leave `level` (level ≥ 2), relative to previous cost. */
export function getLevelXpGrowthFactor(level: number): number {
  if (level <= 10) return 1.15;
  if (level <= 20) return 1.2;
  if (level <= 30) return 1.25;
  if (level <= 40) return 1.3;
  return 1.35;
}

/** XP needed to advance from `level` to `level + 1`. */
export function getXpRequiredForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  let xp = PLAYER_BASE_LEVEL_XP;
  for (let n = 2; n <= safeLevel; n++) {
    xp = Math.round(xp * getLevelXpGrowthFactor(n));
  }
  return xp;
}

export interface PlayerLevelProgress {
  level: number;
  totalXp: number;
  /** XP earned within the current level */
  currentXp: number;
  /** XP needed to reach the next level */
  requiredXp: number;
  /** 0–100 */
  progressPct: number;
}

export function getPlayerLevelProgress(totalXp: number): PlayerLevelProgress {
  const safeTotal = Math.max(0, Math.floor(totalXp));
  let level = 1;
  let remaining = safeTotal;
  let required = getXpRequiredForLevel(level);

  while (remaining >= required) {
    remaining -= required;
    level += 1;
    required = getXpRequiredForLevel(level);
  }

  const progressPct =
    required <= 0 ? 100 : Math.min(100, Math.floor((remaining / required) * 100));

  return {
    level,
    totalXp: safeTotal,
    currentXp: remaining,
    requiredXp: required,
    progressPct,
  };
}

export function formatXpProgress(progress: PlayerLevelProgress) {
  return `${progress.currentXp.toLocaleString()}/${progress.requiredXp.toLocaleString()}(${progress.progressPct}%)`;
}
