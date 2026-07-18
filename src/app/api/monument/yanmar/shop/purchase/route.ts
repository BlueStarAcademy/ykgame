import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkshopWeekKey } from "@/games/yanmar/workshop";
import {
  MONUMENT_SHOP_ITEMS,
  syncMonumentPhase,
} from "@/games/yanmar/monument";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    itemId?: unknown;
  } | null;
  const itemId = typeof body?.itemId === "string" ? body.itemId : "";
  const item = MONUMENT_SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) {
    return NextResponse.json({ error: "Invalid itemId" }, { status: 400 });
  }

  const weekKey = getWorkshopWeekKey();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const phase = await syncMonumentPhase(tx, session.user.id);
      if (phase !== "active") throw new Error("NOT_ACTIVE");

      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: {
          monumentPoints: true,
          gachaTicketsStandard: true,
          gachaTicketsPremium: true,
          enhanceCores: true,
        },
      });
      if (!user) throw new Error("USER_NOT_FOUND");
      if (user.monumentPoints < item.cost) {
        throw new Error("INSUFFICIENT_POINTS");
      }

      const purchase = await tx.userMonumentShopPurchase.findUnique({
        where: {
          userId_itemId_weekKey: {
            userId: session.user.id,
            itemId: item.id,
            weekKey,
          },
        },
      });
      const count = purchase?.count ?? 0;
      if (count >= item.weeklyLimit) throw new Error("WEEKLY_LIMIT");

      const inventoryUpdate =
        item.id === "ticket_standard"
          ? { gachaTicketsStandard: { increment: 1 } }
          : item.id === "ticket_premium"
            ? { gachaTicketsPremium: { increment: 1 } }
            : { enhanceCores: { increment: 1 } };

      await tx.user.update({
        where: { id: session.user.id },
        data: {
          monumentPoints: { decrement: item.cost },
          ...inventoryUpdate,
        },
      });

      await tx.userMonumentShopPurchase.upsert({
        where: {
          userId_itemId_weekKey: {
            userId: session.user.id,
            itemId: item.id,
            weekKey,
          },
        },
        create: {
          userId: session.user.id,
          itemId: item.id,
          weekKey,
          count: 1,
        },
        update: { count: { increment: 1 } },
      });

      const refreshed = await tx.user.findUnique({
        where: { id: session.user.id },
        select: {
          monumentPoints: true,
          gachaTicketsStandard: true,
          gachaTicketsPremium: true,
          enhanceCores: true,
        },
      });

      return {
        points: refreshed?.monumentPoints ?? 0,
        gachaTicketsStandard: refreshed?.gachaTicketsStandard ?? 0,
        gachaTicketsPremium: refreshed?.gachaTicketsPremium ?? 0,
        enhanceCores: refreshed?.enhanceCores ?? 0,
        remaining: Math.max(0, item.weeklyLimit - (count + 1)),
      };
    });

    return NextResponse.json({ ok: true, itemId: item.id, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
