import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseRewardEventId,
  runReplayableRewardEvent,
} from "@/lib/yanmar-rewards";
import {
  WORKSHOP_DEFS,
  isWorkshopId,
  workshopPointsField,
} from "@/games/yanmar/workshop";

const MAX_POINTS = 200;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    eventId?: unknown;
    workshopId?: unknown;
    questId?: unknown;
    points?: unknown;
  } | null;

  const eventId = parseRewardEventId(body?.eventId);
  const workshopId = body?.workshopId;
  const questId =
    typeof body?.questId === "string" ? body.questId.slice(0, 80) : "";
  const points =
    typeof body?.points === "number" ? Math.floor(body.points) : NaN;

  if (!eventId || !eventId.startsWith("workshop-quest:")) {
    return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
  }
  if (!isWorkshopId(workshopId)) {
    return NextResponse.json({ error: "Invalid workshopId" }, { status: 400 });
  }
  const def = WORKSHOP_DEFS[workshopId].quests.find((q) => q.id === questId);
  if (!def) {
    return NextResponse.json({ error: "Invalid questId" }, { status: 400 });
  }
  if (!Number.isFinite(points) || points !== def.rewardPoints || points > MAX_POINTS) {
    return NextResponse.json({ error: "Invalid points" }, { status: 400 });
  }

  const field = workshopPointsField(workshopId);

  try {
    const result = await prisma.$transaction(async (tx) => {
      return runReplayableRewardEvent(
        tx,
        { userId: session.user.id, gameId: "yanmar", eventId },
        async () => {
          const user = await tx.user.update({
            where: { id: session.user.id },
            data: { [field]: { increment: points } },
            select: {
              dumpWorkshopPoints: true,
              crashWorkshopPoints: true,
              hillWorkshopPoints: true,
            },
          });

          await tx.userRewardInventory.create({
            data: {
              userId: session.user.id,
              gameId: "yanmar",
              type: "STAR",
              amount: 0,
              metadata: {
                eventId,
                workshopId,
                questId,
                workshopPoints: points,
                source: "workshop-quest",
              },
            },
          });

          return {
            eventId,
            workshopId,
            questId,
            pointsGranted: points,
            points: {
              dump: user.dumpWorkshopPoints,
              crash: user.crashWorkshopPoints,
              hill: user.hillWorkshopPoints,
            },
          };
        },
      );
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
