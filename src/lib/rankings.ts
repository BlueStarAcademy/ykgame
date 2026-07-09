import { prisma } from "@/lib/prisma";
import { getSeasonKey, getSeasonPeriodKeys } from "@/lib/games";

export interface RankingEntry {
  rank: number;
  userId: string;
  nickname: string;
  score: number;
  stars: number;
  playTime: number;
}

export interface UserGameStats {
  rank: number | null;
  bestScore: number;
  bestStars: number;
  playTime: number;
}

type ScoreWithUser = {
  userId: string;
  score: number;
  stars: number;
  playTime: number;
  user: { nickname: string | null; loginId: string };
};

function dedupeBestPerUser(scores: ScoreWithUser[]): ScoreWithUser[] {
  const bestByUser = new Map<string, ScoreWithUser>();
  for (const s of scores) {
    const existing = bestByUser.get(s.userId);
    if (!existing || s.score > existing.score) {
      bestByUser.set(s.userId, s);
    }
  }
  return Array.from(bestByUser.values()).sort((a, b) => b.score - a.score);
}

export async function getMonthlyRankings(
  gameId: string,
  limit = 10,
  seasonKey = getSeasonKey(),
): Promise<RankingEntry[]> {
  const scores = await prisma.gameScore.findMany({
    where: { gameId, monthKey: { in: getSeasonPeriodKeys(seasonKey) } },
    orderBy: { score: "desc" },
    include: {
      user: { select: { nickname: true, loginId: true } },
    },
  });

  return dedupeBestPerUser(scores)
    .slice(0, limit)
    .map((s, index) => ({
      rank: index + 1,
      userId: s.userId,
      nickname: s.user.nickname ?? s.user.loginId,
      score: s.score,
      stars: s.stars,
      playTime: s.playTime,
    }));
}

export async function getUserGameStats(
  gameId: string,
  userId: string,
  seasonKey = getSeasonKey(),
): Promise<UserGameStats> {
  const scores = await prisma.gameScore.findMany({
    where: { gameId, monthKey: { in: getSeasonPeriodKeys(seasonKey) } },
    orderBy: { score: "desc" },
    include: {
      user: { select: { nickname: true, loginId: true } },
    },
  });

  const ranked = dedupeBestPerUser(scores);
  const userEntry = ranked.find((s) => s.userId === userId);

  if (!userEntry) {
    return { rank: null, bestScore: 0, bestStars: 0, playTime: 0 };
  }

  const rank = ranked.findIndex((s) => s.userId === userId) + 1;
  return {
    rank,
    bestScore: userEntry.score,
    bestStars: userEntry.stars,
    playTime: userEntry.playTime,
  };
}
