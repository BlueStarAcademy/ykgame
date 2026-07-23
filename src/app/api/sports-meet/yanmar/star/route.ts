import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cappedCurrencyIncrement } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import {
  parseRewardEventId,
  randomInt,
  runReplayableRewardEvent,
} from "@/lib/yanmar-rewards";
import {
  SPORTS_MEET_MISSION_DEFAULTS,
  SPORTS_MEET_STAR_REWARD_MAX,
  SPORTS_MEET_STAR_REWARD_MIN,
  sportsMeetStarEventId,
} from "@/games/yanmar/sportsMeet/missionBalance";
import { getSportsMeetDayKey } from "@/games/yanmar/sportsMeet/weekKey";

const MAX_STARS_PER_RUN =
  SPORTS_MEET_MISSION_DEFAULTS.drive.starCount * 3; // 3 drive legs

/**
 * Grant currency for one ranked sports-meet course star (10–30).
 * Practice mode never calls this. Idempotent per runId+starId.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    runId?: unknown;
    starId?: unknown;
  } | null;

  const runId =
    typeof body?.runId === "string" && /^[A-Za-z0-9._:-]{4,64}$/.test(body.runId)
      ? body.runId
      : null;
  const starId =
    typeof body?.starId === "string" &&
    /^[A-Za-z0-9._:-]{3,64}$/.test(body.starId)
      ? body.starId
      : null;
  if (!runId || !starId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const eventId = parseRewardEventId(sportsMeetStarEventId(runId, starId));
  if (!eventId) {
    return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
  }

  const dayKey = getSportsMeetDayKey();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: {
          sportsMeetDayKey: true,
          sportsMeetAttemptsUsed: true,
          currency: true,
        },
      });
      if (!user) throw new Error("USER_NOT_FOUND");
      // Ranked ticket is consumed on enter — require today's attempt.
      if (
        user.sportsMeetDayKey !== dayKey ||
        user.sportsMeetAttemptsUsed < 1
      ) {
        throw new Error("NO_RANKED_RUN");
      }

      return runReplayableRewardEvent(
        tx,
        { userId: session.user.id, gameId: "yanmar", eventId },
        async () => {
          const runLockKey = `sports-meet-star-run:${session.user.id}:${runId}`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${runLockKey}))`;

          const prior = await tx.rewardEvent.count({
            where: {
              userId: session.user.id,
              gameId: "yanmar",
              eventId: { startsWith: `sm-star:${runId}:` },
            },
          });
          if (prior >= MAX_STARS_PER_RUN) {
            throw new Error("RUN_STAR_CAP");
          }

          const rolled = randomInt(
            SPORTS_MEET_STAR_REWARD_MIN,
            SPORTS_MEET_STAR_REWARD_MAX,
          );
          const { next, granted } = cappedCurrencyIncrement(
            user.currency,
            rolled,
          );
          const updated = await tx.user.update({
            where: { id: session.user.id },
            data: { currency: next },
            select: { currency: true },
          });

          if (granted > 0) {
            await tx.userRewardInventory.create({
              data: {
                userId: session.user.id,
                gameId: "yanmar",
                type: "STAR",
                amount: granted,
                metadata: {
                  eventId,
                  source: "sports-meet-star",
                  label: "운동회 코스 스타",
                  runId,
                  starId,
                  dayKey,
                },
              },
            });
          }

          return {
            eventId,
            stars: granted,
            currency: updated.currency,
            runId,
            starId,
          };
        },
      );
    });

    return NextResponse.json(result.result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NO_RANKED_RUN") {
        return NextResponse.json({ error: "No ranked run" }, { status: 403 });
      }
      if (error.message === "RUN_STAR_CAP") {
        return NextResponse.json({ error: "Run star cap" }, { status: 429 });
      }
      if (error.message === "USER_NOT_FOUND") {
        return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
      }
    }
    console.error("[sports-meet-star]", error);
    return NextResponse.json({ error: "Reward failed" }, { status: 500 });
  }
}
