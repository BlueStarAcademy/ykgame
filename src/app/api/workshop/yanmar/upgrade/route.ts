import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlayerLevelProgress } from "@/lib/playerLevel";
import {
  getWorkshopUpgradeCost,
  getWorkshopUpgradeMaxLevel,
  isValidUpgradeKey,
  isWorkshopId,
  workshopPointsField,
} from "@/games/yanmar/workshop";
import {
  getUpgradeDurationMs,
  getWorkshopUpgradeRequiredPlayerLevel,
} from "@/games/yanmar/upgradeTimers";
import {
  findWorkshopPending,
  settleWorkshopPendingUpgrades,
} from "@/games/yanmar/workshop/pending";

/** Start a timed workshop upgrade (does not raise level until timer completes). */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    workshopId?: unknown;
    upgradeKey?: unknown;
  } | null;

  const workshopId = body?.workshopId;
  const upgradeKey =
    typeof body?.upgradeKey === "string" ? body.upgradeKey : "";

  if (!isWorkshopId(workshopId)) {
    return NextResponse.json({ error: "Invalid workshopId" }, { status: 400 });
  }
  if (!isValidUpgradeKey(workshopId, upgradeKey)) {
    return NextResponse.json({ error: "Invalid upgradeKey" }, { status: 400 });
  }

  const field = workshopPointsField(workshopId);
  const maxLevel = getWorkshopUpgradeMaxLevel(upgradeKey);

  try {
    const result = await prisma.$transaction(async (tx) => {
      await settleWorkshopPendingUpgrades(tx, session.user.id);

      const existingPending = await findWorkshopPending(
        tx,
        session.user.id,
        workshopId,
      );
      if (existingPending) throw new Error("UPGRADE_IN_PROGRESS");

      const existing = await tx.userWorkshopUpgrade.findUnique({
        where: {
          userId_workshopId_upgradeKey: {
            userId: session.user.id,
            workshopId,
            upgradeKey,
          },
        },
      });
      const currentLevel = existing?.level ?? 0;
      if (currentLevel >= maxLevel) throw new Error("MAX_LEVEL");

      const targetLevel = currentLevel + 1;
      const requiredPlayerLevel =
        getWorkshopUpgradeRequiredPlayerLevel(targetLevel);
      if (requiredPlayerLevel == null) throw new Error("INVALID_LEVEL");

      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: {
          dumpWorkshopPoints: true,
          crashWorkshopPoints: true,
          hillWorkshopPoints: true,
          totalXp: true,
        },
      });
      if (!user) throw new Error("USER_NOT_FOUND");

      const playerLevel = getPlayerLevelProgress(user.totalXp).level;
      if (playerLevel < requiredPlayerLevel) {
        throw new Error("LEVEL_LOCKED");
      }

      const cost = getWorkshopUpgradeCost(upgradeKey, currentLevel);
      if (cost == null || cost <= 0) throw new Error("INVALID_COST");
      if (user[field] < cost) throw new Error("INSUFFICIENT_POINTS");

      const durationMs = getUpgradeDurationMs(targetLevel);
      if (durationMs == null) throw new Error("INVALID_DURATION");
      const completesAt = new Date(Date.now() + durationMs);

      await tx.user.update({
        where: { id: session.user.id },
        data: { [field]: { decrement: cost } },
      });

      await tx.userWorkshopUpgrade.upsert({
        where: {
          userId_workshopId_upgradeKey: {
            userId: session.user.id,
            workshopId,
            upgradeKey,
          },
        },
        create: {
          userId: session.user.id,
          workshopId,
          upgradeKey,
          level: currentLevel,
          pendingCompletesAt: completesAt,
        },
        update: { pendingCompletesAt: completesAt },
      });

      const refreshed = await tx.user.findUnique({
        where: { id: session.user.id },
        select: {
          dumpWorkshopPoints: true,
          crashWorkshopPoints: true,
          hillWorkshopPoints: true,
        },
      });

      return {
        workshopId,
        upgradeKey,
        level: currentLevel,
        targetLevel,
        completesAt: completesAt.toISOString(),
        cost,
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
