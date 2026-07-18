import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncMonumentPhase } from "@/games/yanmar/monument";

const EVENT_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    eventId?: unknown;
    questId?: unknown;
    points?: unknown;
  } | null;

  const eventId = typeof body?.eventId === "string" ? body.eventId : "";
  const questId = typeof body?.questId === "string" ? body.questId : "";
  const points =
    typeof body?.points === "number" ? Math.floor(body.points) : 0;

  if (!EVENT_ID_PATTERN.test(eventId)) {
    return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
  }
  if (!questId || points <= 0 || points > 200) {
    return NextResponse.json({ error: "Invalid reward" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const phase = await syncMonumentPhase(tx, session.user.id);
      if (phase !== "active") throw new Error("NOT_ACTIVE");

      const existing = await tx.rewardEvent.findUnique({
        where: {
          userId_gameId_eventId: {
            userId: session.user.id,
            gameId: "yanmar",
            eventId,
          },
        },
      });
      if (existing) {
        const user = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { monumentPoints: true },
        });
        return {
          points: user?.monumentPoints ?? 0,
          duplicate: true,
        };
      }

      await tx.rewardEvent.create({
        data: {
          userId: session.user.id,
          gameId: "yanmar",
          eventId,
          result: { kind: "monument-quest", questId, points },
        },
      });

      const updated = await tx.user.update({
        where: { id: session.user.id },
        data: { monumentPoints: { increment: points } },
        select: { monumentPoints: true },
      });

      return { points: updated.monumentPoints, duplicate: false };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
