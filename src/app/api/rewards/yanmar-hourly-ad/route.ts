import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { cappedCurrencyIncrement } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import {
  parseRewardEventId,
  runReplayableRewardEvent,
} from "@/lib/yanmar-rewards";
import {
  getActiveHourlyAd,
  getHourlyAdHourBucket,
  makeHourlyAdEventId,
  parseHourlyAdEventId,
  rollHourlyAdReward,
  type HourlyAdReward,
} from "@/games/yanmar/hourlyAdReward";

function grantSelect() {
  return {
    currency: true,
    gachaTicketsStandard: true,
    gachaTicketsPremium: true,
    dumpWorkshopPoints: true,
    crashWorkshopPoints: true,
    hillWorkshopPoints: true,
    monumentPoints: true,
  } as const;
}

async function applyHourlyAdReward(
  tx: Prisma.TransactionClient,
  userId: string,
  eventId: string,
  reward: HourlyAdReward,
) {
  const current = await tx.user.findUnique({
    where: { id: userId },
    select: { currency: true },
  });

  let starsGranted = 0;
  let nextCurrency = current?.currency ?? 0;

  if (reward.kind === "stars") {
    const capped = cappedCurrencyIncrement(nextCurrency, reward.amount);
    nextCurrency = capped.next;
    starsGranted = capped.granted;
  }

  const user = await tx.user.update({
    where: { id: userId },
    data: {
      ...(reward.kind === "stars" && starsGranted > 0
        ? { currency: nextCurrency }
        : {}),
      ...(reward.kind === "gachaStandard"
        ? { gachaTicketsStandard: { increment: reward.amount } }
        : {}),
      ...(reward.kind === "gachaPremium"
        ? { gachaTicketsPremium: { increment: reward.amount } }
        : {}),
      ...(reward.kind === "dumpPoints"
        ? { dumpWorkshopPoints: { increment: reward.amount } }
        : {}),
      ...(reward.kind === "crashPoints"
        ? { crashWorkshopPoints: { increment: reward.amount } }
        : {}),
      ...(reward.kind === "hillPoints"
        ? { hillWorkshopPoints: { increment: reward.amount } }
        : {}),
      ...(reward.kind === "monumentPoints"
        ? { monumentPoints: { increment: reward.amount } }
        : {}),
    },
    select: grantSelect(),
  });

  await tx.userRewardInventory.create({
    data: {
      userId,
      gameId: "yanmar",
      type: "STAR",
      amount: starsGranted,
      metadata: {
        eventId,
        source: "hourly-ad",
        label: "정시 광고 보상",
        rewardKind: reward.kind,
        rewardAmount: reward.amount,
        rewardLabel: reward.label,
      },
    },
  });

  return {
    eventId,
    reward: {
      ...reward,
      amount: reward.kind === "stars" ? starsGranted : reward.amount,
    },
    currency: user.currency,
    gachaTicketsStandard: user.gachaTicketsStandard,
    gachaTicketsPremium: user.gachaTicketsPremium,
    dumpWorkshopPoints: user.dumpWorkshopPoints,
    crashWorkshopPoints: user.crashWorkshopPoints,
    hillWorkshopPoints: user.hillWorkshopPoints,
    monumentPoints: user.monumentPoints,
  };
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
  const parsed = eventId ? parseHourlyAdEventId(eventId) : null;
  const active = getActiveHourlyAd();
  const currentBucket = getHourlyAdHourBucket();

  if (!eventId || parsed === null) {
    return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
  }
  if (
    !active ||
    parsed.hourBucket !== currentBucket ||
    parsed.hourBucket !== active.hourBucket ||
    parsed.slotId !== active.slot.id
  ) {
    return NextResponse.json(
      { error: "Hour window expired", expired: true },
      { status: 400 },
    );
  }
  if (eventId !== makeHourlyAdEventId(parsed.hourBucket, parsed.slotId)) {
    return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      return runReplayableRewardEvent(
        tx,
        { userId: session.user.id, gameId: "yanmar", eventId },
        async () => {
          const reward = rollHourlyAdReward();
          return applyHourlyAdReward(tx, session.user.id, eventId, reward);
        },
      );
    });

    return NextResponse.json({
      ...outcome.result,
      replayed: outcome.replayed,
    });
  } catch (error) {
    console.error("[yanmar-hourly-ad]", error);
    return NextResponse.json({ error: "Reward failed" }, { status: 500 });
  }
}
