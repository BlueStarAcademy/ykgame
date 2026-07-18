import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncMonumentPhase } from "@/games/yanmar/monument";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const phase = await syncMonumentPhase(tx, session.user.id);
      if (phase !== "claimable") throw new Error("NOT_CLAIMABLE");

      const now = new Date();
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          monumentPhase: "active",
          monumentStarsStored: 0,
          monumentProdUpdatedAt: now,
        },
      });

      return { phase: "active" as const };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
