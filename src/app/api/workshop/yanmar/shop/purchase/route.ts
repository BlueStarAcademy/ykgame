import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  WORKSHOP_SHOP_ITEMS,
  getWorkshopWeekKey,
  isWorkshopId,
  workshopPointsField,
  type WorkshopShopItemId,
} from "@/games/yanmar/workshop";

function isShopItemId(value: unknown): value is WorkshopShopItemId {
  return (
    value === "ticket_standard" ||
    value === "ticket_premium" ||
    value === "enhance_core"
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    workshopId?: unknown;
    itemId?: unknown;
  } | null;

  const workshopId = body?.workshopId;
  const itemId = body?.itemId;

  if (!isWorkshopId(workshopId)) {
    return NextResponse.json({ error: "Invalid workshopId" }, { status: 400 });
  }
  if (!isShopItemId(itemId)) {
    return NextResponse.json({ error: "Invalid itemId" }, { status: 400 });
  }

  const item = WORKSHOP_SHOP_ITEMS.find((i) => i.id === itemId)!;
  const field = workshopPointsField(workshopId);
  const weekKey = getWorkshopWeekKey();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.userWorkshopShopPurchase.findUnique({
        where: {
          userId_workshopId_itemId_weekKey: {
            userId: session.user.id,
            workshopId,
            itemId,
            weekKey,
          },
        },
      });
      const bought = purchase?.count ?? 0;
      if (bought >= item.weeklyLimit) {
        throw new Error("WEEKLY_LIMIT");
      }

      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: {
          dumpWorkshopPoints: true,
          crashWorkshopPoints: true,
          hillWorkshopPoints: true,
          gachaTicketsStandard: true,
          gachaTicketsPremium: true,
          enhanceCores: true,
        },
      });
      if (!user) throw new Error("USER_NOT_FOUND");
      if (user[field] < item.cost) throw new Error("INSUFFICIENT_POINTS");

      const grantData =
        itemId === "ticket_standard"
          ? { gachaTicketsStandard: { increment: 1 } }
          : itemId === "ticket_premium"
            ? { gachaTicketsPremium: { increment: 1 } }
            : { enhanceCores: { increment: 1 } };

      const refreshed = await tx.user.update({
        where: { id: session.user.id },
        data: {
          [field]: { decrement: item.cost },
          ...grantData,
        },
        select: {
          dumpWorkshopPoints: true,
          crashWorkshopPoints: true,
          hillWorkshopPoints: true,
          gachaTicketsStandard: true,
          gachaTicketsPremium: true,
          enhanceCores: true,
        },
      });

      const updatedPurchase = await tx.userWorkshopShopPurchase.upsert({
        where: {
          userId_workshopId_itemId_weekKey: {
            userId: session.user.id,
            workshopId,
            itemId,
            weekKey,
          },
        },
        create: {
          userId: session.user.id,
          workshopId,
          itemId,
          weekKey,
          count: 1,
        },
        update: { count: { increment: 1 } },
      });

      return {
        workshopId,
        itemId,
        cost: item.cost,
        weekKey,
        weeklyCount: updatedPurchase.count,
        weeklyRemaining: Math.max(0, item.weeklyLimit - updatedPurchase.count),
        points: {
          dump: refreshed.dumpWorkshopPoints,
          crash: refreshed.crashWorkshopPoints,
          hill: refreshed.hillWorkshopPoints,
        },
        gachaTicketsStandard: refreshed.gachaTicketsStandard,
        gachaTicketsPremium: refreshed.gachaTicketsPremium,
        enhanceCores: refreshed.enhanceCores,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
