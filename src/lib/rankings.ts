import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSeasonKey, getSeasonPeriodKeys } from "@/lib/games";
import { createTtlCache } from "@/lib/ttl-cache";
import {
  deleteRedisKeys,
  readRedisJson,
  writeRedisJson,
} from "@/lib/redis-cache";
import { getRedisConfig } from "@/lib/redis-config";
import { rankingsTopKey, userStatsKey } from "@/lib/redis-keys";
import {
  isRankingEntries,
  isUserGameStats,
} from "@/lib/ranking-cache-validation";

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

type AggregateMode = "best" | "sum";

type AggRow = {
  userId: string;
  nickname: string | null;
  loginId: string;
  score: number | bigint;
  stars: number | bigint;
  playTime: number | bigint;
};

type UserAggRow = {
  score: number | bigint;
  stars: number | bigint;
  playTime: number | bigint;
};

type RankRow = { rank: number | bigint };

/** Local caches are used only while Redis is disabled or unavailable. */
const rankingsCache = createTtlCache<RankingEntry[]>(20_000);
const userStatsCache = createTtlCache<UserGameStats>(20_000);
const RANKINGS_TTL_SECONDS = 20;
const USER_STATS_TTL_SECONDS = 20;

function rankingModeForGame(gameId: string): AggregateMode {
  // Yanmar arcade ranks by season-long cumulative score.
  return gameId === "yanmar" ? "sum" : "best";
}

function monthKeyIn(seasonKey: string) {
  const keys = getSeasonPeriodKeys(seasonKey);
  return Prisma.join(keys.map((key) => Prisma.sql`${key}`));
}

function toInt(value: number | bigint | null | undefined) {
  if (value == null) return 0;
  return typeof value === "bigint" ? Number(value) : value;
}

function mapRankingRows(rows: AggRow[]): RankingEntry[] {
  return rows.map((row, index) => ({
    rank: index + 1,
    userId: row.userId,
    nickname: row.nickname ?? row.loginId,
    score: toInt(row.score),
    stars: toInt(row.stars),
    playTime: toInt(row.playTime),
  }));
}

async function queryTopRankingsSum(
  gameId: string,
  seasonKey: string,
  limit: number,
): Promise<RankingEntry[]> {
  const rows = await prisma.$queryRaw<AggRow[]>`
    SELECT
      stats."userId" AS "userId",
      u.nickname AS nickname,
      u."loginId" AS "loginId",
      stats."totalScore"::int AS score,
      stats."totalStars"::int AS stars,
      stats."totalPlayTime"::int AS "playTime"
    FROM "UserSeasonStats" stats
    INNER JOIN "User" u ON u.id = stats."userId"
    WHERE stats."gameId" = ${gameId}
      AND stats."seasonKey" = ${seasonKey}
    ORDER BY stats."totalScore" DESC, stats."userId" ASC
    LIMIT ${limit}
  `;
  return mapRankingRows(rows);
}

async function queryTopRankingsBest(
  gameId: string,
  seasonKey: string,
  limit: number,
): Promise<RankingEntry[]> {
  const rows = await prisma.$queryRaw<AggRow[]>`
    SELECT
      ranked."userId" AS "userId",
      u.nickname AS nickname,
      u."loginId" AS "loginId",
      ranked.score::int AS score,
      ranked.stars::int AS stars,
      ranked."playTime"::int AS "playTime"
    FROM (
      SELECT DISTINCT ON (gs."userId")
        gs."userId",
        gs.score,
        gs.stars,
        gs."playTime"
      FROM "GameScore" gs
      WHERE gs."gameId" = ${gameId}
        AND gs."monthKey" IN (${monthKeyIn(seasonKey)})
      ORDER BY gs."userId", gs.score DESC, gs."createdAt" DESC
    ) ranked
    INNER JOIN "User" u ON u.id = ranked."userId"
    ORDER BY ranked.score DESC, ranked."userId" ASC
    LIMIT ${limit}
  `;
  return mapRankingRows(rows);
}

async function queryUserAggregateSum(
  gameId: string,
  userId: string,
  seasonKey: string,
): Promise<UserAggRow> {
  const rows = await prisma.$queryRaw<UserAggRow[]>`
    SELECT
      "totalScore"::int AS score,
      "totalStars"::int AS stars,
      "totalPlayTime"::int AS "playTime"
    FROM "UserSeasonStats"
    WHERE "userId" = ${userId}
      AND "gameId" = ${gameId}
      AND "seasonKey" = ${seasonKey}
    LIMIT 1
  `;
  return rows[0] ?? { score: 0, stars: 0, playTime: 0 };
}

async function queryUserAggregateBest(
  gameId: string,
  userId: string,
  seasonKey: string,
): Promise<UserAggRow> {
  const rows = await prisma.$queryRaw<UserAggRow[]>`
    SELECT
      score::int AS score,
      stars::int AS stars,
      "playTime"::int AS "playTime"
    FROM "GameScore"
    WHERE "userId" = ${userId}
      AND "gameId" = ${gameId}
      AND "monthKey" IN (${monthKeyIn(seasonKey)})
    ORDER BY score DESC, "createdAt" DESC
    LIMIT 1
  `;
  return rows[0] ?? { score: 0, stars: 0, playTime: 0 };
}

async function queryUserRankSum(
  gameId: string,
  seasonKey: string,
  userScore: number,
): Promise<number> {
  const rows = await prisma.$queryRaw<RankRow[]>`
    SELECT (COUNT(*) + 1)::int AS rank
    FROM "UserSeasonStats"
    WHERE "gameId" = ${gameId}
      AND "seasonKey" = ${seasonKey}
      AND "totalScore" > ${userScore}
  `;
  return toInt(rows[0]?.rank) || 1;
}

async function queryUserRankBest(
  gameId: string,
  seasonKey: string,
  userScore: number,
): Promise<number> {
  const rows = await prisma.$queryRaw<RankRow[]>`
    SELECT (COUNT(*) + 1)::int AS rank
    FROM (
      SELECT "userId", MAX(score) AS "bestScore"
      FROM "GameScore"
      WHERE "gameId" = ${gameId}
        AND "monthKey" IN (${monthKeyIn(seasonKey)})
      GROUP BY "userId"
      HAVING MAX(score) > ${userScore}
    ) better
  `;
  return toInt(rows[0]?.rank) || 1;
}

export async function getMonthlyRankings(
  gameId: string,
  limit = 10,
  seasonKey = getSeasonKey(),
): Promise<RankingEntry[]> {
  const mode = rankingModeForGame(gameId);
  const cacheKey = `${gameId}:${seasonKey}:${limit}:${mode}`;
  const config = getRedisConfig();
  const sharedKey = rankingsTopKey(
    config.prefix,
    gameId,
    seasonKey,
    limit,
    mode,
  );
  const shared = await readRedisJson(sharedKey, isRankingEntries);
  if (shared.available && shared.hit) return shared.value;
  if (!shared.available) {
    const cached = rankingsCache.get(cacheKey);
    if (cached) return cached;
  }

  const rankings =
    mode === "sum"
      ? await queryTopRankingsSum(gameId, seasonKey, limit)
      : await queryTopRankingsBest(gameId, seasonKey, limit);

  rankingsCache.set(cacheKey, rankings);
  if (shared.available) {
    await writeRedisJson(sharedKey, rankings, RANKINGS_TTL_SECONDS);
  }
  return rankings;
}

export async function getUserGameStats(
  gameId: string,
  userId: string,
  seasonKey = getSeasonKey(),
): Promise<UserGameStats> {
  const mode = rankingModeForGame(gameId);
  const cacheKey = `${gameId}:${seasonKey}:${userId}:${mode}`;
  const config = getRedisConfig();
  const sharedKey = userStatsKey(
    config.prefix,
    gameId,
    seasonKey,
    userId,
    mode,
  );
  const shared = await readRedisJson(sharedKey, isUserGameStats);
  if (shared.available && shared.hit) return shared.value;
  if (!shared.available) {
    const cached = userStatsCache.get(cacheKey);
    if (cached) return cached;
  }

  const aggregate =
    mode === "sum"
      ? await queryUserAggregateSum(gameId, userId, seasonKey)
      : await queryUserAggregateBest(gameId, userId, seasonKey);

  const bestScore = toInt(aggregate.score);
  const bestStars = toInt(aggregate.stars);
  const playTime = toInt(aggregate.playTime);

  if (bestScore <= 0 && bestStars <= 0 && playTime <= 0) {
    const empty: UserGameStats = {
      rank: null,
      bestScore: 0,
      bestStars: 0,
      playTime: 0,
    };
    userStatsCache.set(cacheKey, empty);
    if (shared.available) {
      await writeRedisJson(sharedKey, empty, USER_STATS_TTL_SECONDS);
    }
    return empty;
  }

  const rank =
    mode === "sum"
      ? await queryUserRankSum(gameId, seasonKey, bestScore)
      : await queryUserRankBest(gameId, seasonKey, bestScore);

  const stats = { rank, bestScore, bestStars, playTime };
  userStatsCache.set(cacheKey, stats);
  if (shared.available) {
    await writeRedisJson(sharedKey, stats, USER_STATS_TTL_SECONDS);
  }
  return stats;
}

export async function invalidateRankingCaches(
  gameId: string,
  userId: string,
  seasonKey = getSeasonKey(),
): Promise<void> {
  const mode = rankingModeForGame(gameId);
  const topLocalKey = `${gameId}:${seasonKey}:10:${mode}`;
  const statsLocalKey = `${gameId}:${seasonKey}:${userId}:${mode}`;
  rankingsCache.delete(topLocalKey);
  userStatsCache.delete(statsLocalKey);

  const config = getRedisConfig();
  await deleteRedisKeys(
    rankingsTopKey(config.prefix, gameId, seasonKey, 10, mode),
    userStatsKey(config.prefix, gameId, seasonKey, userId, mode),
  );
}

/** Fetch stats only for the given games (skips empty placeholders). */
export async function getUserGameStatsForGames(
  gameIds: string[],
  userId: string,
  seasonKey = getSeasonKey(),
): Promise<Map<string, UserGameStats>> {
  const entries = await Promise.all(
    gameIds.map(async (gameId) => {
      const stats = await getUserGameStats(gameId, userId, seasonKey);
      return [gameId, stats] as const;
    }),
  );
  return new Map(entries);
}
