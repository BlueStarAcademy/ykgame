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

type AggregateMode = "best" | "sum";

function rankingModeForGame(gameId: string): AggregateMode {
  // Yanmar arcade ranks by season-long cumulative score across plays.
  return gameId === "yanmar" ? "sum" : "best";
}

function aggregateScoresPerUser(
  scores: ScoreWithUser[],
  mode: AggregateMode,
): ScoreWithUser[] {
  const byUser = new Map<string, ScoreWithUser>();
  for (const s of scores) {
    const existing = byUser.get(s.userId);
    if (!existing) {
      byUser.set(s.userId, { ...s });
      continue;
    }
    if (mode === "sum") {
      byUser.set(s.userId, {
        ...existing,
        score: existing.score + s.score,
        stars: existing.stars + s.stars,
        playTime: existing.playTime + s.playTime,
      });
      continue;
    }
    if (s.score > existing.score) {
      byUser.set(s.userId, s);
    }
  }
  return Array.from(byUser.values()).sort((a, b) => b.score - a.score);
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

  return aggregateScoresPerUser(scores, rankingModeForGame(gameId))
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

  const ranked = aggregateScoresPerUser(scores, rankingModeForGame(gameId));
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
