import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameById, getMonthKey } from "@/lib/games";
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

  const monthKey = getMonthKey();
  const rankings = await getMonthlyRankings(gameId, 10, monthKey);

  const session = await auth();
  let myStats = null;
  if (session?.user) {
    myStats = await getUserGameStats(gameId, session.user.id, monthKey);
  }

  return NextResponse.json({ monthKey, rankings, myStats });
}
