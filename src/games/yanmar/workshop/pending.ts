import type { PrismaClient } from "@/generated/prisma/client";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends" | "$use"
>;

export type WorkshopPendingInfo = {
  workshopId: string;
  upgradeKey: string;
  completesAt: string;
  targetLevel: number;
};

/** Apply any workshop upgrades whose timers have elapsed. */
export async function settleWorkshopPendingUpgrades(
  tx: Tx,
  userId: string,
  now = new Date(),
): Promise<void> {
  const due = await tx.userWorkshopUpgrade.findMany({
    where: {
      userId,
      pendingCompletesAt: { lte: now },
    },
  });
  for (const row of due) {
    await tx.userWorkshopUpgrade.update({
      where: { id: row.id },
      data: {
        level: row.level + 1,
        pendingCompletesAt: null,
      },
    });
  }
}

export async function findWorkshopPending(
  tx: Tx,
  userId: string,
  workshopId: string,
): Promise<WorkshopPendingInfo | null> {
  const row = await tx.userWorkshopUpgrade.findFirst({
    where: {
      userId,
      workshopId,
      pendingCompletesAt: { not: null },
    },
  });
  if (!row?.pendingCompletesAt) return null;
  return {
    workshopId: row.workshopId,
    upgradeKey: row.upgradeKey,
    completesAt: row.pendingCompletesAt.toISOString(),
    targetLevel: row.level + 1,
  };
}

export function pendingMapFromRows(
  rows: {
    workshopId: string;
    upgradeKey: string;
    level: number;
    pendingCompletesAt: Date | null;
  }[],
): Partial<Record<string, WorkshopPendingInfo>> {
  const out: Partial<Record<string, WorkshopPendingInfo>> = {};
  for (const row of rows) {
    if (!row.pendingCompletesAt) continue;
    out[row.workshopId] = {
      workshopId: row.workshopId,
      upgradeKey: row.upgradeKey,
      completesAt: row.pendingCompletesAt.toISOString(),
      targetLevel: row.level + 1,
    };
  }
  return out;
}
