import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateScore,
  calculateStars,
  getGameById,
  getSeasonKey,
  isGameAvailable,
} from "@/lib/games";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { gameId, progress, playTime, timeLeft, arcadeScore, dumpUnits, mode } = body;

  const game = getGameById(gameId);
  if (!game) {
    return NextResponse.json({ error: "Invalid game" }, { status: 400 });
  }
  if (!isGameAvailable(gameId)) {
    return NextResponse.json({ error: "Game not available" }, { status: 403 });
  }

  const isYanmarArcade =
    gameId === "yanmar" &&
    mode === "game" &&
    ((typeof dumpUnits === "number" && dumpUnits >= 0) ||
      (typeof arcadeScore === "number" && arcadeScore >= 0));
  if (gameId === "yanmar" && mode !== "game") {
    return NextResponse.json(
      { error: "Yanmar practice results are not saved" },
      { status: 400 },
    );
  }
  const stars = isYanmarArcade ? 0 : calculateStars(progress);
  const score = isYanmarArcade
    ? Math.round(typeof dumpUnits === "number" ? dumpUnits : arcadeScore)
    : calculateScore(progress, timeLeft ?? 0);
  const seasonKey = getSeasonKey();

  const result = await prisma.$transaction(async (tx) => {
    const gameScore = await tx.gameScore.create({
      data: {
        userId: session.user.id,
        gameId,
        score,
        stars,
        playTime: playTime ?? 0,
        monthKey: seasonKey,
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
