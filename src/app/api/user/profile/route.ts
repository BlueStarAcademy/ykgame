import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AVAILABLE_GAME_IDS, GAMES, getSeasonKey } from "@/lib/games";
import { getUserGameStatsForGames } from "@/lib/rankings";
import {
  isValidProfileAvatarId,
  NICKNAME_CHANGE_COST_STARS,
  validateNickname,
} from "@/lib/profile";

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
      profileAvatarId: true,
      currency: true,
      totalXp: true,
      role: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const seasonKey = getSeasonKey();
  const statsByGame = await getUserGameStatsForGames(
    AVAILABLE_GAME_IDS,
    user.id,
    seasonKey,
  );

  const gameProgress = GAMES.map((game) => {
    const stats = statsByGame.get(game.id);
    return {
      gameId: game.id,
      score: stats?.bestScore ?? 0,
      stars: stats?.bestStars ?? 0,
      playTime: stats?.playTime ?? 0,
    };
  });

  const totalStars = gameProgress.reduce((sum, g) => sum + g.stars, 0);

  return NextResponse.json({
    user: {
      ...user,
      totalStars,
    },
    gameProgress,
    nicknameChangeCostStars: NICKNAME_CHANGE_COST_STARS,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { nickname, profileAvatarId } = body as {
    nickname?: unknown;
    profileAvatarId?: unknown;
  };

  const wantsNickname = nickname !== undefined;
  const wantsAvatar = profileAvatarId !== undefined;

  if (!wantsNickname && !wantsAvatar) {
    return NextResponse.json(
      { error: "변경할 항목이 없습니다." },
      { status: 400 },
    );
  }

  if (wantsAvatar && !isValidProfileAvatarId(profileAvatarId)) {
    return NextResponse.json(
      { error: "유효하지 않은 프로필 이미지입니다." },
      { status: 400 },
    );
  }

  let nextNickname: string | undefined;
  if (wantsNickname) {
    const parsed = validateNickname(nickname);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }
    nextNickname = parsed.nickname;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id: session.user.id },
        select: {
          nickname: true,
          profileAvatarId: true,
          currency: true,
        },
      });
      if (!current) {
        throw new Error("NOT_FOUND");
      }

      const data: {
        nickname?: string;
        profileAvatarId?: string;
        currency?: number;
      } = {};

      if (wantsAvatar) {
        data.profileAvatarId = profileAvatarId as string;
      }

      let chargedStars = 0;
      if (nextNickname !== undefined) {
        const isFirstNickname = !current.nickname;
        const nicknameChanged = current.nickname !== nextNickname;

        if (nicknameChanged) {
          if (!isFirstNickname) {
            if (current.currency < NICKNAME_CHANGE_COST_STARS) {
              throw new Error("INSUFFICIENT_STARS");
            }
            chargedStars = NICKNAME_CHANGE_COST_STARS;
            data.currency = current.currency - NICKNAME_CHANGE_COST_STARS;
          }

          const existing = await tx.user.findFirst({
            where: {
              nickname: nextNickname,
              NOT: { id: session.user.id },
            },
            select: { id: true },
          });
          if (existing) {
            throw new Error("NICKNAME_TAKEN");
          }
          data.nickname = nextNickname;
        }
      }

      if (Object.keys(data).length === 0) {
        return {
          nickname: current.nickname,
          profileAvatarId: current.profileAvatarId,
          currency: current.currency,
          totalXp: undefined as number | undefined,
          chargedStars: 0,
        };
      }

      const user = await tx.user.update({
        where: { id: session.user.id },
        data,
        select: {
          nickname: true,
          profileAvatarId: true,
          currency: true,
          totalXp: true,
        },
      });

      return { ...user, chargedStars };
    });

    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (code === "INSUFFICIENT_STARS") {
      return NextResponse.json(
        {
          error: `닉네임 변경에는 스타 ${NICKNAME_CHANGE_COST_STARS}개가 필요합니다.`,
          costStars: NICKNAME_CHANGE_COST_STARS,
        },
        { status: 402 },
      );
    }
    if (code === "NICKNAME_TAKEN") {
      return NextResponse.json(
        { error: "이미 사용 중인 닉네임입니다." },
        { status: 409 },
      );
    }
    // Prisma unique race
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "이미 사용 중인 닉네임입니다." },
        { status: 409 },
      );
    }
    console.error("[profile] PATCH failed:", error);
    return NextResponse.json(
      { error: "프로필 저장에 실패했습니다." },
      { status: 500 },
    );
  }
}
