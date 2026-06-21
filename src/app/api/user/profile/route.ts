import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GAMES, getMonthKey } from "@/lib/games";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      loginId: true,
      nickname: true,
      currency: true,
      role: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const scores = await prisma.gameScore.findMany({
    where: { userId: user.id },
    orderBy: { score: "desc" },
  });

  const bestByGame = new Map<
    string,
    { score: number; stars: number; playTime: number }
  >();
  for (const s of scores) {
    const existing = bestByGame.get(s.gameId);
    if (!existing || s.score > existing.score) {
      bestByGame.set(s.gameId, {
        score: s.score,
        stars: s.stars,
        playTime: s.playTime,
      });
    }
  }

  const gameProgress = GAMES.map((game) => ({
    gameId: game.id,
    ...(bestByGame.get(game.id) ?? { score: 0, stars: 0, playTime: 0 }),
  }));

  const totalStars = gameProgress.reduce((sum, g) => sum + g.stars, 0);

  return NextResponse.json({
    user: {
      ...user,
      totalStars,
    },
    gameProgress,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { nickname } = await request.json();
  if (!nickname || nickname.length < 2 || nickname.length > 12) {
    return NextResponse.json(
      { error: "닉네임은 2~12자여야 합니다." },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findFirst({
    where: {
      nickname,
      NOT: { id: session.user.id },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "이미 사용 중인 닉네임입니다." },
      { status: 409 },
    );
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { nickname },
    select: { nickname: true, currency: true },
  });

  return NextResponse.json(user);
}
