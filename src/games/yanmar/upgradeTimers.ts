/** Shared upgrade build durations (index 0 = reaching +1). */
export const UPGRADE_DURATION_MINUTES = [
  1, 10, 30, 60, 90, 120, 180, 240, 300, 360,
] as const;

export const UPGRADE_DURATION_MS = UPGRADE_DURATION_MINUTES.map(
  (m) => m * 60_000,
) as readonly number[];

/** Player level required to start workshop upgrade to +N (index 0 = +1). */
export const WORKSHOP_UPGRADE_MIN_LEVEL = [
  1, 4, 7, 10, 13, 16, 19, 22, 25, 30,
] as const;

/** Player level required to start monument upgrade to +N (index 0 = +1). */
export const MONUMENT_UPGRADE_MIN_LEVEL = [
  20, 22, 24, 26, 28, 30, 32, 34, 37, 40,
] as const;

export const INSTANT_COMPLETE_STARS_PER_MINUTE = 10;

export function getUpgradeDurationMs(targetLevel: number): number | null {
  if (targetLevel < 1 || targetLevel > UPGRADE_DURATION_MS.length) return null;
  return UPGRADE_DURATION_MS[targetLevel - 1]!;
}

export function getWorkshopUpgradeRequiredPlayerLevel(
  targetLevel: number,
): number | null {
  if (targetLevel < 1 || targetLevel > WORKSHOP_UPGRADE_MIN_LEVEL.length) {
    return null;
  }
  return WORKSHOP_UPGRADE_MIN_LEVEL[targetLevel - 1]!;
}

export function getMonumentUpgradeRequiredPlayerLevel(
  targetLevel: number,
): number | null {
  if (targetLevel < 1 || targetLevel > MONUMENT_UPGRADE_MIN_LEVEL.length) {
    return null;
  }
  return MONUMENT_UPGRADE_MIN_LEVEL[targetLevel - 1]!;
}

export function instantCompleteStars(remainingMs: number): number {
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 60_000) * INSTANT_COMPLETE_STARS_PER_MINUTE;
}

export function formatUpgradeRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
