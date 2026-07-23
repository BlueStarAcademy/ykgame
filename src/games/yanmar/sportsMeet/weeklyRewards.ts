/** Weekly ranking star rewards — edit tiers here to rebalance. */

export const SPORTS_MEET_WEEKLY_REWARD_TIERS = [
  { minRank: 1, maxRank: 1, stars: 3000 },
  { minRank: 2, maxRank: 2, stars: 1500 },
  { minRank: 3, maxRank: 3, stars: 750 },
  { minRank: 4, maxRank: 10, stars: 500 },
  { minRank: 11, maxRank: 100, stars: 250 },
  { minRank: 101, maxRank: Number.POSITIVE_INFINITY, stars: 100 },
] as const;

export function sportsMeetStarsForRank(rank: number): number {
  if (!Number.isFinite(rank) || rank < 1) return 0;
  for (const tier of SPORTS_MEET_WEEKLY_REWARD_TIERS) {
    if (rank >= tier.minRank && rank <= tier.maxRank) return tier.stars;
  }
  return 0;
}

export function formatSportsMeetRewardTiersKo() {
  return SPORTS_MEET_WEEKLY_REWARD_TIERS.map((t) => {
    const range =
      t.minRank === t.maxRank
        ? `${t.minRank}위`
        : t.maxRank === Number.POSITIVE_INFINITY
          ? `${t.minRank}위~`
          : `${t.minRank}~${t.maxRank}위`;
    return `${range}: ${t.stars.toLocaleString()}★`;
  });
}
