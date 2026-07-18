import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  MONUMENT_CONSTRUCTION_MS,
  syncMonumentPhase,
} from "@/games/yanmar/monument";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const phase = await syncMonumentPhase(tx, session.user.id);
      if (phase !== "quest") throw new Error("NOT_IN_QUEST");

      const endsAt = new Date(Date.now() + MONUMENT_CONSTRUCTION_MS);
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          monumentPhase: "building",
          monumentConstructionEndsAt: endsAt,
        },
      });

      return {
        phase: "building" as const,
        constructionEndsAt: endsAt.toISOString(),
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
