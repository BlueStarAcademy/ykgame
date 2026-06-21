import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateScore,
  calculateStars,
  getGameById,
  getMonthKey,
} from "@/lib/games";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { gameId, progress, playTime, timeLeft } = body;

  const game = getGameById(gameId);
  if (!game) {
    return NextResponse.json({ error: "Invalid game" }, { status: 400 });
  }

  const stars = calculateStars(progress);
  const score = calculateScore(progress, timeLeft ?? 0);
  const monthKey = getMonthKey();

  const result = await prisma.$transaction(async (tx) => {
    const gameScore = await tx.gameScore.create({
      data: {
        userId: session.user.id,
        gameId,
        score,
        stars,
        playTime: playTime ?? 0,
        monthKey,
      },
    });

    if (stars > 0) {
      await tx.user.update({
        where: { id: session.user.id },
        data: { currency: { increment: stars } },
      });
    }

    const user = await tx.user.findUnique({
      where: { id: session.user.id },
      select: { currency: true },
    });

    return { gameScore, currency: user?.currency ?? 0 };
  });

  return NextResponse.json({
    score: result.gameScore.score,
    stars: result.gameScore.stars,
    currency: result.currency,
  });
}
