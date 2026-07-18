import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkshopWeekKey } from "@/games/yanmar/workshop";
import {
  MONUMENT_SHOP_ITEMS,
  MONUMENT_UPGRADES,
  findMonumentPending,
  settleMonumentPendingUpgrades,
  syncMonumentPhase,
  syncMonumentProduction,
  type MonumentUpgradeKey,
} from "@/games/yanmar/monument";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const weekKey = getWorkshopWeekKey();

  const snapshot = await prisma.$transaction(async (tx) => {
    await settleMonumentPendingUpgrades(tx, userId);
    const phase = await syncMonumentPhase(tx, userId);
    const prod = await syncMonumentProduction(tx, userId);
    const pending = await findMonumentPending(tx, userId);

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        monumentPoints: true,
        monumentPhase: true,
        monumentConstructionEndsAt: true,
        monumentStarsStored: true,
        monumentProdUpdatedAt: true,
        monumentTutorialDone: true,
        gachaTicketsStandard: true,
        gachaTicketsPremium: true,
        enhanceCores: true,
        currency: true,
        totalXp: true,
      },
    });
    if (!user) throw new Error("USER_NOT_FOUND");

    const upgrades = await tx.userMonumentUpgrade.findMany({
      where: { userId },
      select: { upgradeKey: true, level: true, pendingCompletesAt: true },
    });

    const purchases = await tx.userMonumentShopPurchase.findMany({
      where: { userId, weekKey },
      select: { itemId: true, count: true },
    });

    return { phase, prod, pending, user, upgrades, purchases };
  });

  const levels: Record<string, number> = {};
  for (const def of MONUMENT_UPGRADES) {
    levels[def.key] = 0;
  }
  for (const row of snapshot.upgrades) {
    levels[row.upgradeKey] = row.level;
  }

  const shopPurchases: Record<string, { count: number; remaining: number }> =
    {};
  for (const item of MONUMENT_SHOP_ITEMS) {
    const row = snapshot.purchases.find((p) => p.itemId === item.id);
    const count = row?.count ?? 0;
    shopPurchases[item.id] = {
      count,
      remaining: Math.max(0, item.weeklyLimit - count),
    };
  }

  return NextResponse.json({
    ok: true,
    weekKey,
    phase: snapshot.phase || snapshot.user.monumentPhase,
    points: snapshot.user.monumentPoints,
    levels: levels as Record<MonumentUpgradeKey, number>,
    pending: snapshot.pending,
    constructionEndsAt:
      snapshot.user.monumentConstructionEndsAt?.toISOString() ?? null,
    starsStored: snapshot.prod.stored,
    prodUpdatedAt: snapshot.user.monumentProdUpdatedAt?.toISOString() ?? null,
    tutorialDone: snapshot.user.monumentTutorialDone,
    shopPurchases,
    shopItems: MONUMENT_SHOP_ITEMS,
    gachaTicketsStandard: snapshot.user.gachaTicketsStandard,
    gachaTicketsPremium: snapshot.user.gachaTicketsPremium,
    enhanceCores: snapshot.user.enhanceCores,
    currency: snapshot.user.currency,
    totalXp: snapshot.user.totalXp,
  });
}
