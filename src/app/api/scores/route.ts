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
import { cappedCurrencyIncrement } from "@/lib/currency";
import { withHotApiObservability } from "@/lib/hot-api-observability";
import { parseScoreSessionId } from "@/lib/request-idempotency";
import { invalidateRankingCaches } from "@/lib/rankings";

export const POST = withHotApiObservability(
  "/api/scores",
  async (request, _routeContext, observation) => {
  observation.setMetadata({ batchSize: 1 });
  const session = await auth();
  if (!session?.user) {
    observation.setMetadata({
      outcome: "unauthorized",
      errorCode: "UNAUTHORIZED",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    gameId,
    progress,
    playTime,
    timeLeft,
    arcadeScore,
    mode,
    sessionId: rawSessionId,
  } = body;
  const sessionId = parseScoreSessionId(rawSessionId);
  if (rawSessionId != null && !sessionId) {
    observation.setMetadata({
      outcome: "invalid_request",
      errorCode: "INVALID_SESSION_ID",
    });
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }

  const game = getGameById(gameId);
  if (!game) {
    observation.setMetadata({
      outcome: "invalid_request",
      errorCode: "INVALID_GAME",
    });
    return NextResponse.json({ error: "Invalid game" }, { status: 400 });
  }
  if (!isGameAvailable(gameId)) {
    observation.setMetadata({
      outcome: "forbidden",
      errorCode: "GAME_NOT_AVAILABLE",
    });
    return NextResponse.json({ error: "Game not available" }, { status: 403 });
  }

  const isYanmarArcade =
    gameId === "yanmar" &&
    mode === "game" &&
    typeof arcadeScore === "number" &&
    arcadeScore >= 0;
  if (gameId === "yanmar" && mode !== "game") {
    observation.setMetadata({
      outcome: "invalid_request",
      errorCode: "PRACTICE_RESULT",
    });
    return NextResponse.json(
      { error: "Yanmar practice results are not saved" },
      { status: 400 },
    );
  }
  if (gameId === "yanmar" && mode === "game" && !sessionId) {
    observation.setMetadata({
      outcome: "invalid_request",
      errorCode: "SESSION_ID_REQUIRED",
    });
    return NextResponse.json(
      { error: "sessionId is required for Yanmar game mode" },
      { status: 400 },
    );
  }
  const stars = isYanmarArcade ? 0 : calculateStars(progress);
  const score = isYanmarArcade
    ? Math.round(arcadeScore)
    : calculateScore(progress, timeLeft ?? 0);
  const seasonKey = getSeasonKey();

  const result = await prisma.$transaction(async (tx) => {
    if (sessionId) {
      const lockKey = `game-score:${session.user.id}:${gameId}:${sessionId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      const existing = await tx.gameScore.findUnique({
        where: {
          userId_gameId_sessionId: {
            userId: session.user.id,
            gameId,
            sessionId,
          },
        },
      });
      if (existing) {
        const user = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { currency: true },
        });
        return {
          gameScore: existing,
          currency: user?.currency ?? 0,
          duplicate: true,
        };
      }
    }

    const gameScore = await tx.gameScore.create({
      data: {
        userId: session.user.id,
        gameId,
        sessionId,
        score,
        stars,
        playTime: playTime ?? 0,
        monthKey: seasonKey,
      },
    });

    await tx.$executeRaw`
      INSERT INTO "UserSeasonStats" (
        "id",
        "userId",
        "gameId",
        "seasonKey",
        "totalScore",
        "totalStars",
        "totalPlayTime",
        "updatedAt"
      )
      VALUES (
        ${`season_${gameScore.id}`},
        ${session.user.id},
        ${gameId},
        ${seasonKey},
        ${score},
        ${stars},
        ${playTime ?? 0},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("userId", "gameId", "seasonKey") DO UPDATE SET
        "totalScore" = "UserSeasonStats"."totalScore" + EXCLUDED."totalScore",
        "totalStars" = "UserSeasonStats"."totalStars" + EXCLUDED."totalStars",
        "totalPlayTime" =
          "UserSeasonStats"."totalPlayTime" + EXCLUDED."totalPlayTime",
        "updatedAt" = CURRENT_TIMESTAMP
    `;

    if (stars > 0) {
      const current = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { currency: true },
      });
      const { next } = cappedCurrencyIncrement(current?.currency ?? 0, stars);
      await tx.user.update({
        where: { id: session.user.id },
        data: { currency: next },
      });
    }

    const user = await tx.user.findUnique({
      where: { id: session.user.id },
      select: { currency: true },
    });

    return { gameScore, currency: user?.currency ?? 0, duplicate: false };
  });

  if (!result.duplicate) {
    await invalidateRankingCaches(gameId, session.user.id, seasonKey);
  }

  observation.setMetadata({
    outcome: "success",
    duplicate: result.duplicate,
  });
  return NextResponse.json({
    score: result.gameScore.score,
    stars: result.gameScore.stars,
    currency: result.currency,
  });
  },
);
