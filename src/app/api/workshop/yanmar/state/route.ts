import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  WORKSHOP_DEFS,
  WORKSHOP_IDS,
  WORKSHOP_SHOP_ITEMS,
  getWorkshopWeekKey,
  workshopPointsField,
  type WorkshopId,
} from "@/games/yanmar/workshop";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const weekKey = getWorkshopWeekKey();

  const [user, upgrades, purchases] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        dumpWorkshopPoints: true,
        crashWorkshopPoints: true,
        hillWorkshopPoints: true,
        gachaTicketsStandard: true,
        gachaTicketsPremium: true,
        enhanceCores: true,
        currency: true,
      },
    }),
    prisma.userWorkshopUpgrade.findMany({
      where: { userId },
      select: { workshopId: true, upgradeKey: true, level: true },
    }),
    prisma.userWorkshopShopPurchase.findMany({
      where: { userId, weekKey },
      select: { workshopId: true, itemId: true, count: true },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const points: Record<WorkshopId, number> = {
    dump: user.dumpWorkshopPoints,
    crash: user.crashWorkshopPoints,
    hill: user.hillWorkshopPoints,
  };

  const levels: Record<WorkshopId, Record<string, number>> = {
    dump: {},
    crash: {},
    hill: {},
  };
  for (const id of WORKSHOP_IDS) {
    for (const def of WORKSHOP_DEFS[id].upgrades) {
      levels[id][def.key] = 0;
    }
  }
  for (const row of upgrades) {
    if (row.workshopId === "dump" || row.workshopId === "crash" || row.workshopId === "hill") {
      levels[row.workshopId][row.upgradeKey] = row.level;
    }
  }

  const shopPurchases: Record<
    WorkshopId,
    Record<string, { count: number; remaining: number }>
  > = {
    dump: {},
    crash: {},
    hill: {},
  };
  for (const id of WORKSHOP_IDS) {
    for (const item of WORKSHOP_SHOP_ITEMS) {
      const row = purchases.find(
        (p) => p.workshopId === id && p.itemId === item.id,
      );
      const count = row?.count ?? 0;
      shopPurchases[id][item.id] = {
        count,
        remaining: Math.max(0, item.weeklyLimit - count),
      };
    }
  }

  return NextResponse.json({
    ok: true,
    weekKey,
    points,
    levels,
    shopPurchases,
    shopItems: WORKSHOP_SHOP_ITEMS,
    gachaTicketsStandard: user.gachaTicketsStandard,
    gachaTicketsPremium: user.gachaTicketsPremium,
    enhanceCores: user.enhanceCores,
    currency: user.currency,
    pointsFields: {
      dump: workshopPointsField("dump"),
      crash: workshopPointsField("crash"),
      hill: workshopPointsField("hill"),
    },
  });
}
