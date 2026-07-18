import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  settleMonumentPendingUpgrades,
  syncMonumentPhase,
  syncMonumentProduction,
} from "@/games/yanmar/monument";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await settleMonumentPendingUpgrades(tx, session.user.id);
      const phase = await syncMonumentPhase(tx, session.user.id);
      if (phase !== "active") throw new Error("NOT_ACTIVE");

      await syncMonumentProduction(tx, session.user.id);
      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { monumentStarsStored: true, currency: true },
      });
      if (!user) throw new Error("USER_NOT_FOUND");
      const claimed = user.monumentStarsStored;
      if (claimed <= 0) throw new Error("NO_STARS");

      const updated = await tx.user.update({
        where: { id: session.user.id },
        data: {
          monumentStarsStored: 0,
          monumentProdUpdatedAt: new Date(),
          currency: { increment: claimed },
        },
        select: { currency: true },
      });

      return { claimed, currency: updated.currency, starsStored: 0 };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
