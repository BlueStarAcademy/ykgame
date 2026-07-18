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
  getWorldPickupHourBucket,
  getWorldPickupHourStartMs,
  STAR_REWARD_MAX,
  STAR_REWARD_MIN,
  STARS_PER_HOUR,
} from "@/games/yanmar/worldPickups";

function currentHourStart() {
  return new Date(getWorldPickupHourStartMs(getWorldPickupHourBucket()));
}

async function countWorldStarPickupsThisHour(userId: string) {
  const since = currentHourStart();
  const recent = await prisma.userRewardInventory.findMany({
    where: {
      userId,
      gameId: "yanmar",
      type: "STAR",
      createdAt: { gte: since },
    },
    select: { metadata: true },
    take: STARS_PER_HOUR + 8,
    orderBy: { createdAt: "desc" },
  });
  return recent.filter((row) => {
    const meta = row.metadata as { source?: unknown } | null;
    return meta?.source === "world-star";
  }).length;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    eventId?: unknown;
  } | null;

  const eventId = parseRewardEventId(body?.eventId);
  if (!eventId || !eventId.startsWith("world-star:")) {
    return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
  }

  try {
    const priorCount = await countWorldStarPickupsThisHour(session.user.id);
    if (priorCount >= STARS_PER_HOUR) {
      return NextResponse.json(
        { error: "Hourly limit reached", limited: true, stars: 0 },
        { status: 429 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      return runReplayableRewardEvent(
        tx,
        { userId: session.user.id, gameId: "yanmar", eventId },
        async () => {
          // Re-check inside the transaction to close the race window.
          const since = currentHourStart();
          const recent = await tx.userRewardInventory.findMany({
            where: {
              userId: session.user.id,
              gameId: "yanmar",
              type: "STAR",
              createdAt: { gte: since },
            },
            select: { metadata: true },
            take: STARS_PER_HOUR + 8,
            orderBy: { createdAt: "desc" },
          });
          const worldStarCount = recent.filter((row) => {
            const meta = row.metadata as { source?: unknown } | null;
            return meta?.source === "world-star";
          }).length;
          if (worldStarCount >= STARS_PER_HOUR) {
            throw new Error("WORLD_STAR_HOURLY_LIMIT");
          }

          const rolled = randomInt(STAR_REWARD_MIN, STAR_REWARD_MAX);
          const current = await tx.user.findUnique({
            where: { id: session.user.id },
            select: { currency: true },
          });
          const { next, granted } = cappedCurrencyIncrement(
            current?.currency ?? 0,
            rolled,
          );
          const user = await tx.user.update({
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
                  source: "world-star",
                  label: "월드 스타",
                },
              },
            });
          }

          return {
            eventId,
            stars: granted,
            currency: user.currency,
          };
        },
      );
    });

    return NextResponse.json(result.result);
  } catch (error) {
    if (error instanceof Error && error.message === "WORLD_STAR_HOURLY_LIMIT") {
      return NextResponse.json(
        { error: "Hourly limit reached", limited: true, stars: 0 },
        { status: 429 },
      );
    }
    console.error("[yanmar-world-pickup]", error);
    return NextResponse.json({ error: "Reward failed" }, { status: 500 });
  }
}
