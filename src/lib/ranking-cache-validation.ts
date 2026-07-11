import type { RankingEntry, UserGameStats } from "@/lib/rankings";

function isSafeInteger(value: unknown, minimum = 0): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum
  );
}

export function isRankingEntry(value: unknown): value is RankingEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    isSafeInteger(entry.rank, 1) &&
    typeof entry.userId === "string" &&
    entry.userId.length > 0 &&
    entry.userId.length <= 128 &&
    typeof entry.nickname === "string" &&
    entry.nickname.length <= 128 &&
    isSafeInteger(entry.score) &&
    isSafeInteger(entry.stars) &&
    isSafeInteger(entry.playTime)
  );
}

export function isRankingEntries(value: unknown): value is RankingEntry[] {
  return (
    Array.isArray(value) &&
    value.length <= 100 &&
    value.every(isRankingEntry)
  );
}

export function isUserGameStats(value: unknown): value is UserGameStats {
  if (!value || typeof value !== "object") return false;
  const stats = value as Record<string, unknown>;
  return (
    (stats.rank === null || isSafeInteger(stats.rank, 1)) &&
    isSafeInteger(stats.bestScore) &&
    isSafeInteger(stats.bestStars) &&
    isSafeInteger(stats.playTime)
  );
}
