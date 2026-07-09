import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameById, getSeasonInfo } from "@/lib/games";
import { getMonthlyRankings, getUserGameStats } from "@/lib/rankings";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;
  const game = getGameById(gameId);
  if (!game) {
    return NextResponse.json({ error: "Invalid game" }, { status: 404 });
  }

  const season = getSeasonInfo();
  const rankings = await getMonthlyRankings(gameId, 10, season.key);

  const session = await auth();
  let myStats = null;
  if (session?.user) {
    const stats = await getUserGameStats(gameId, session.user.id, season.key);
    myStats = {
      ...stats,
      nickname:
        session.user.nickname ??
        rankings.find((r) => r.userId === session.user.id)?.nickname ??
        session.user.loginId ??
        "나",
    };
  }

  return NextResponse.json({
    seasonKey: season.key,
    seasonLabel: season.label,
    seasonEndsAt: season.endsAt.toISOString(),
    rankings,
    myStats,
  });
}
