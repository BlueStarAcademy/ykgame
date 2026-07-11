import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameById, getSeasonInfo } from "@/lib/games";
import { withHotApiObservability } from "@/lib/hot-api-observability";
import { getMonthlyRankings, getUserGameStats } from "@/lib/rankings";

export const GET = withHotApiObservability(
  "/api/rankings/[gameId]",
  async (
    _request,
    { params }: { params: Promise<{ gameId: string }> },
    observation,
  ) => {
  const { gameId } = await params;
  const game = getGameById(gameId);
  if (!game) {
    observation.setMetadata({
      outcome: "not_found",
      errorCode: "INVALID_GAME",
    });
    return NextResponse.json({ error: "Invalid game" }, { status: 404 });
  }

  const season = getSeasonInfo();
  const session = await auth();

  const [rankings, stats] = await Promise.all([
    getMonthlyRankings(gameId, 10, season.key),
    session?.user
      ? getUserGameStats(gameId, session.user.id, season.key)
      : Promise.resolve(null),
  ]);

  const myStats = stats
    ? {
        ...stats,
        nickname:
          session?.user.nickname ??
          rankings.find((r) => r.userId === session?.user.id)?.nickname ??
          session?.user.loginId ??
          "나",
      }
    : null;

  observation.setMetadata({
    outcome: "success",
    batchSize: rankings.length,
  });
  return NextResponse.json({
    seasonKey: season.key,
    seasonLabel: season.label,
    seasonEndsAt: season.endsAt.toISOString(),
    rankings,
    myStats,
  });
  },
);
