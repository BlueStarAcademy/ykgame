import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGameById, getMonthKey } from "@/lib/games";

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

  const scores = await prisma.gameScore.findMany({
    where: { gameId, monthKey },
    orderBy: { score: "desc" },
    take: 10,
    include: {
      user: { select: { nickname: true, loginId: true } },
    },
  });

  const rankings = scores.map((s, index) => ({
    rank: index + 1,
    nickname: s.user.nickname ?? s.user.loginId,
    score: s.score,
    stars: s.stars,
    playTime: s.playTime,
  }));

  return NextResponse.json({ monthKey, rankings });
}
