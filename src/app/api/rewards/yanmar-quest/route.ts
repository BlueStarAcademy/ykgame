import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseRewardEventId,
  runReplayableRewardEvent,
} from "@/lib/yanmar-rewards";

const MAX_STARS = 40;
const MAX_XP = 6000;
const MAX_CORES = 16;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    eventId?: unknown;
    stars?: unknown;
    xp?: unknown;
    enhanceCores?: unknown;
    label?: unknown;
  } | null;

  const eventId = parseRewardEventId(body?.eventId);
  const stars = typeof body?.stars === "number" ? Math.floor(body.stars) : NaN;
  const xp = typeof body?.xp === "number" ? Math.floor(body.xp) : NaN;
  const enhanceCores =
    typeof body?.enhanceCores === "number" ? Math.floor(body.enhanceCores) : 0;
  const label =
    typeof body?.label === "string" ? body.label.slice(0, 80) : "퀘스트 보상";

  if (!eventId || !eventId.startsWith("quest:")) {
    return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
  }
  if (!Number.isFinite(stars) || stars < 0 || stars > MAX_STARS) {
    return NextResponse.json({ error: "Invalid stars" }, { status: 400 });
  }
  if (!Number.isFinite(xp) || xp < 0 || xp > MAX_XP) {
    return NextResponse.json({ error: "Invalid xp" }, { status: 400 });
  }
  if (
    !Number.isFinite(enhanceCores) ||
    enhanceCores < 0 ||
    enhanceCores > MAX_CORES
  ) {
    return NextResponse.json({ error: "Invalid enhanceCores" }, { status: 400 });
  }
  if (stars === 0 && xp === 0 && enhanceCores === 0) {
    return NextResponse.json({ error: "Empty reward" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      return runReplayableRewardEvent(
        tx,
        { userId: session.user.id, gameId: "yanmar", eventId },
        async () => {
          const user = await tx.user.update({
            where: { id: session.user.id },
            data: {
              ...(stars > 0 ? { currency: { increment: stars } } : {}),
              ...(xp > 0 ? { totalXp: { increment: xp } } : {}),
              ...(enhanceCores > 0
                ? { enhanceCores: { increment: enhanceCores } }
                : {}),
            },
            select: { currency: true, totalXp: true, enhanceCores: true },
          });

          await tx.userRewardInventory.create({
            data: {
              userId: session.user.id,
              gameId: "yanmar",
              type: "STAR",
              amount: stars,
              metadata: {
                eventId,
                xp,
                enhanceCores,
                label,
                source: "quest",
              },
            },
          });

          return {
            eventId,
            currency: user.currency,
            totalXp: user.totalXp,
            enhanceCores: user.enhanceCores,
            stars,
            xp,
            coresGranted: enhanceCores,
          };
        },
      );
    });

    return NextResponse.json(result.result);
  } catch (error) {
    console.error("[yanmar-quest]", error);
    return NextResponse.json({ error: "Reward failed" }, { status: 500 });
  }
}
