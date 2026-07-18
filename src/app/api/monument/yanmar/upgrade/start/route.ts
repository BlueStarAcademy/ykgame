import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlayerLevelProgress } from "@/lib/playerLevel";
import {
  getMonumentUpgradeCost,
  getMonumentUpgradeMaxLevel,
  isMonumentUpgradeKey,
  findMonumentPending,
  settleMonumentPendingUpgrades,
  syncMonumentPhase,
} from "@/games/yanmar/monument";
import {
  getMonumentUpgradeRequiredPlayerLevel,
  getUpgradeDurationMs,
} from "@/games/yanmar/upgradeTimers";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    upgradeKey?: unknown;
  } | null;
  const upgradeKey =
    typeof body?.upgradeKey === "string" ? body.upgradeKey : "";
  if (!isMonumentUpgradeKey(upgradeKey)) {
    return NextResponse.json({ error: "Invalid upgradeKey" }, { status: 400 });
  }

  const maxLevel = getMonumentUpgradeMaxLevel(upgradeKey);

  try {
    const result = await prisma.$transaction(async (tx) => {
      await settleMonumentPendingUpgrades(tx, session.user.id);
      const phase = await syncMonumentPhase(tx, session.user.id);
      if (phase !== "active") throw new Error("NOT_ACTIVE");

      const existingPending = await findMonumentPending(tx, session.user.id);
      if (existingPending) throw new Error("UPGRADE_IN_PROGRESS");

      const existing = await tx.userMonumentUpgrade.findUnique({
        where: {
          userId_upgradeKey: { userId: session.user.id, upgradeKey },
        },
      });
      const currentLevel = existing?.level ?? 0;
      if (currentLevel >= maxLevel) throw new Error("MAX_LEVEL");

      const targetLevel = currentLevel + 1;
      const requiredPlayerLevel =
        getMonumentUpgradeRequiredPlayerLevel(targetLevel);
      if (requiredPlayerLevel == null) throw new Error("INVALID_LEVEL");

      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { monumentPoints: true, totalXp: true },
      });
      if (!user) throw new Error("USER_NOT_FOUND");

      const playerLevel = getPlayerLevelProgress(user.totalXp).level;
      if (playerLevel < requiredPlayerLevel) throw new Error("LEVEL_LOCKED");

      const cost = getMonumentUpgradeCost(upgradeKey, currentLevel);
      if (cost == null || cost <= 0) throw new Error("INVALID_COST");
      if (user.monumentPoints < cost) throw new Error("INSUFFICIENT_POINTS");

      const durationMs = getUpgradeDurationMs(targetLevel);
      if (durationMs == null) throw new Error("INVALID_DURATION");
      const completesAt = new Date(Date.now() + durationMs);

      await tx.user.update({
        where: { id: session.user.id },
        data: { monumentPoints: { decrement: cost } },
      });

      await tx.userMonumentUpgrade.upsert({
        where: {
          userId_upgradeKey: { userId: session.user.id, upgradeKey },
        },
        create: {
          userId: session.user.id,
          upgradeKey,
          level: currentLevel,
          pendingCompletesAt: completesAt,
        },
        update: { pendingCompletesAt: completesAt },
      });

      const refreshed = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { monumentPoints: true },
      });

      return {
        upgradeKey,
        level: currentLevel,
        targetLevel,
        completesAt: completesAt.toISOString(),
        cost,
        points: refreshed?.monumentPoints ?? 0,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
