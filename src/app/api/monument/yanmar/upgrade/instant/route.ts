import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { instantCompleteStars } from "@/games/yanmar/upgradeTimers";
import {
  findMonumentPending,
  settleMonumentPendingUpgrades,
} from "@/games/yanmar/monument";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const settledCount = await settleMonumentPendingUpgrades(
        tx,
        session.user.id,
      );
      const pending = await findMonumentPending(tx, session.user.id);

      if (!pending) {
        const refreshed = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { currency: true, monumentPoints: true },
        });
        if (!refreshed) throw new Error("USER_NOT_FOUND");
        return {
          settledByTimer: settledCount > 0,
          starCost: 0,
          currency: refreshed.currency,
          points: refreshed.monumentPoints,
        };
      }

      const remainingMs = new Date(pending.completesAt).getTime() - Date.now();
      const starCost = instantCompleteStars(remainingMs);

      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { currency: true, monumentPoints: true },
      });
      if (!user) throw new Error("USER_NOT_FOUND");
      if (starCost > 0 && user.currency < starCost) {
        throw new Error("INSUFFICIENT_STARS");
      }

      if (starCost > 0) {
        await tx.user.update({
          where: { id: session.user.id },
          data: { currency: { decrement: starCost } },
        });
      }

      const row = await tx.userMonumentUpgrade.findUnique({
        where: {
          userId_upgradeKey: {
            userId: session.user.id,
            upgradeKey: pending.upgradeKey,
          },
        },
      });
      if (!row) throw new Error("NOT_FOUND");

      const upgraded = await tx.userMonumentUpgrade.update({
        where: { id: row.id },
        data: { level: row.level + 1, pendingCompletesAt: null },
      });

      const refreshed = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { currency: true, monumentPoints: true },
      });

      return {
        upgradeKey: pending.upgradeKey,
        level: upgraded.level,
        settledByTimer: false,
        starCost,
        currency: refreshed?.currency ?? 0,
        points: refreshed?.monumentPoints ?? 0,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
