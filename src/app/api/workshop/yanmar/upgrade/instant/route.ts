import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isWorkshopId } from "@/games/yanmar/workshop";
import { instantCompleteStars } from "@/games/yanmar/upgradeTimers";
import {
  findWorkshopPending,
  settleWorkshopPendingUpgrades,
} from "@/games/yanmar/workshop/pending";

/** Spend stars to finish the in-progress workshop upgrade immediately. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    workshopId?: unknown;
  } | null;

  const workshopId = body?.workshopId;
  if (!isWorkshopId(workshopId)) {
    return NextResponse.json({ error: "Invalid workshopId" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const settledCount = await settleWorkshopPendingUpgrades(
        tx,
        session.user.id,
      );

      const pending = await findWorkshopPending(
        tx,
        session.user.id,
        workshopId,
      );

      const userSelect = {
        currency: true,
        dumpWorkshopPoints: true,
        crashWorkshopPoints: true,
        hillWorkshopPoints: true,
      } as const;

      if (!pending) {
        const refreshed = await tx.user.findUnique({
          where: { id: session.user.id },
          select: userSelect,
        });
        if (!refreshed) throw new Error("USER_NOT_FOUND");
        return {
          workshopId,
          settledByTimer: settledCount > 0,
          starCost: 0,
          currency: refreshed.currency,
          points: {
            dump: refreshed.dumpWorkshopPoints,
            crash: refreshed.crashWorkshopPoints,
            hill: refreshed.hillWorkshopPoints,
          },
        };
      }

      const completesAt = new Date(pending.completesAt);
      const remainingMs = completesAt.getTime() - Date.now();
      const starCost = instantCompleteStars(remainingMs);

      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: userSelect,
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

      const row = await tx.userWorkshopUpgrade.findUnique({
        where: {
          userId_workshopId_upgradeKey: {
            userId: session.user.id,
            workshopId,
            upgradeKey: pending.upgradeKey,
          },
        },
      });
      if (!row) throw new Error("NOT_FOUND");

      const upgraded = await tx.userWorkshopUpgrade.update({
        where: { id: row.id },
        data: {
          level: row.level + 1,
          pendingCompletesAt: null,
        },
      });

      const refreshed = await tx.user.findUnique({
        where: { id: session.user.id },
        select: userSelect,
      });

      return {
        workshopId,
        upgradeKey: pending.upgradeKey,
        level: upgraded.level,
        settledByTimer: false,
        starCost,
        currency: refreshed?.currency ?? 0,
        points: {
          dump: refreshed?.dumpWorkshopPoints ?? 0,
          crash: refreshed?.crashWorkshopPoints ?? 0,
          hill: refreshed?.hillWorkshopPoints ?? 0,
        },
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
