import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getWorkshopUpgradeCost,
  getWorkshopUpgradeMaxLevel,
  isValidUpgradeKey,
  isWorkshopId,
  workshopPointsField,
} from "@/games/yanmar/workshop";

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
      if (currentLevel >= maxLevel) {
        throw new Error("MAX_LEVEL");
      }
      const cost = getWorkshopUpgradeCost(upgradeKey, currentLevel);
      if (cost == null || cost <= 0) throw new Error("INVALID_COST");

      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: {
          dumpWorkshopPoints: true,
          crashWorkshopPoints: true,
          hillWorkshopPoints: true,
        },
      });
      if (!user) throw new Error("USER_NOT_FOUND");
      const points = user[field];
      if (points < cost) throw new Error("INSUFFICIENT_POINTS");

      await tx.user.update({
        where: { id: session.user.id },
        data: { [field]: { decrement: cost } },
      });

      const upgraded = await tx.userWorkshopUpgrade.upsert({
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
          level: currentLevel + 1,
        },
        update: { level: currentLevel + 1 },
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
        level: upgraded.level,
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
