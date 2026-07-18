import type { PrismaClient } from "@/generated/prisma/client";
import { computeProducedStars } from "./economy";
import type { MonumentPhase, MonumentUpgradeKey } from "./types";
import { MONUMENT_UNLOCK_LEVEL } from "./types";
import { getPlayerLevelProgress } from "@/lib/playerLevel";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends" | "$use"
>;

export type MonumentPendingInfo = {
  upgradeKey: string;
  completesAt: string;
  targetLevel: number;
};

export async function settleMonumentPendingUpgrades(
  tx: Tx,
  userId: string,
  now = new Date(),
): Promise<void> {
  const due = await tx.userMonumentUpgrade.findMany({
    where: { userId, pendingCompletesAt: { lte: now } },
  });
  for (const row of due) {
    await tx.userMonumentUpgrade.update({
      where: { id: row.id },
      data: { level: row.level + 1, pendingCompletesAt: null },
    });
  }
}

export async function findMonumentPending(
  tx: Tx,
  userId: string,
): Promise<MonumentPendingInfo | null> {
  const row = await tx.userMonumentUpgrade.findFirst({
    where: { userId, pendingCompletesAt: { not: null } },
  });
  if (!row?.pendingCompletesAt) return null;
  return {
    upgradeKey: row.upgradeKey,
    completesAt: row.pendingCompletesAt.toISOString(),
    targetLevel: row.level + 1,
  };
}

export async function syncMonumentProduction(
  tx: Tx,
  userId: string,
  now = new Date(),
): Promise<{ stored: number; produced: number }> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      monumentPhase: true,
      monumentStarsStored: true,
      monumentProdUpdatedAt: true,
    },
  });
  if (!user || user.monumentPhase !== "active") {
    return { stored: user?.monumentStarsStored ?? 0, produced: 0 };
  }

  const upgrades = await tx.userMonumentUpgrade.findMany({
    where: { userId },
    select: { upgradeKey: true, level: true },
  });
  const levels: Partial<Record<MonumentUpgradeKey, number>> = {};
  for (const row of upgrades) {
    levels[row.upgradeKey as MonumentUpgradeKey] = row.level;
  }

  const result = computeProducedStars({
    stored: user.monumentStarsStored,
    storageLevel: levels.storage_cap ?? 0,
    speedLevel: levels.prod_speed ?? 0,
    prodUpdatedAt: user.monumentProdUpdatedAt,
    now,
  });

  if (result.produced > 0 || !user.monumentProdUpdatedAt) {
    await tx.user.update({
      where: { id: userId },
      data: {
        monumentStarsStored: result.stored,
        monumentProdUpdatedAt: result.nextUpdatedAt,
      },
    });
  }

  return { stored: result.stored, produced: result.produced };
}

export async function syncMonumentPhase(
  tx: Tx,
  userId: string,
  now = new Date(),
): Promise<MonumentPhase> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      totalXp: true,
      monumentPhase: true,
      monumentConstructionEndsAt: true,
    },
  });
  if (!user) return "locked";

  const level = getPlayerLevelProgress(user.totalXp).level;
  let phase = user.monumentPhase as MonumentPhase;

  if (phase === "locked" && level >= MONUMENT_UNLOCK_LEVEL) {
    phase = "quest";
    await tx.user.update({
      where: { id: userId },
      data: { monumentPhase: phase },
    });
  }

  if (
    phase === "building" &&
    user.monumentConstructionEndsAt &&
    user.monumentConstructionEndsAt.getTime() <= now.getTime()
  ) {
    phase = "claimable";
    await tx.user.update({
      where: { id: userId },
      data: { monumentPhase: phase },
    });
  }

  return phase;
}
