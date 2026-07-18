import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureYanmarGearMigration } from "@/games/yanmar/gearMigrate";
import {
  GACHA_CONFIG,
  type GachaBanner,
} from "@/games/yanmar/gearCatalog";
import { createGearItem, pickGrade, pickSlot } from "@/games/yanmar/gearGenerate";
import {
  getUserGearInventorySlots,
  loadUserFinalStats,
} from "@/games/yanmar/gearService";
import { asJson } from "@/games/yanmar/jsonCompat";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { banner?: string; count?: number; payWith?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const banner = body.banner as GachaBanner;
  if (banner !== "STANDARD" && banner !== "PREMIUM") {
    return NextResponse.json({ error: "Invalid banner" }, { status: 400 });
  }
  const count = body.count === 10 ? 10 : 1;
  const payWith = body.payWith === "tickets" ? "tickets" : "stars";
  const cfg = GACHA_CONFIG[banner];
  const starCost = count === 10 ? cfg.cost10 : cfg.cost1;
  const ticketField =
    banner === "PREMIUM" ? "gachaTicketsPremium" : "gachaTicketsStandard";

  try {
    const result = await prisma.$transaction(async (tx) => {
      await ensureYanmarGearMigration(tx, session.user.id);
      const itemCount = await tx.gearItem.count({
        where: { userId: session.user.id, gameId: "yanmar" },
      });
      const inventorySlots = await getUserGearInventorySlots(
        tx,
        session.user.id,
      );
      if (itemCount + count > inventorySlots) {
        throw new Error("INVENTORY_FULL");
      }
      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: {
          currency: true,
          gachaTicketsStandard: true,
          gachaTicketsPremium: true,
        },
      });
      if (!user) throw new Error("USER_NOT_FOUND");

      if (payWith === "tickets") {
        const tickets =
          banner === "PREMIUM"
            ? user.gachaTicketsPremium
            : user.gachaTicketsStandard;
        if (tickets < count) throw new Error("INSUFFICIENT_TICKETS");
        await tx.user.update({
          where: { id: session.user.id },
          data: { [ticketField]: { decrement: count } },
        });
      } else {
        if (user.currency < starCost) throw new Error("INSUFFICIENT_STARS");
        await tx.user.update({
          where: { id: session.user.id },
          data: { currency: { decrement: starCost } },
        });
      }

      const loaded = await loadUserFinalStats(tx, session.user.id);
      const durabilityMax = loaded.stats.durabilityMaxPerPiece;
      const created = [];
      for (let i = 0; i < count; i += 1) {
        const grade = pickGrade([...cfg.grades]);
        const slot = pickSlot();
        const data = createGearItem(slot, grade, durabilityMax);
        const row = await tx.gearItem.create({
          data: {
            userId: session.user.id,
            gameId: "yanmar",
            slot: data.slot,
            grade: data.grade,
            enhanceLevel: 0,
            failBonus: 0,
            mainOption: asJson(data.mainOption),
            subOptions: asJson(data.subOptions),
            masterOption: data.masterOption ? asJson(data.masterOption) : undefined,
            nameSnapshot: data.nameSnapshot,
            durability: data.durability,
            durabilityMax: data.durabilityMax,
            equippedSlot: null,
          },
        });
        created.push({
          id: row.id,
          nameSnapshot: data.nameSnapshot,
          grade: data.grade,
          slot: data.slot,
        });
      }

      await tx.gachaPullLog.create({
        data: {
          userId: session.user.id,
          gameId: "yanmar",
          banner,
          count,
          results: { items: created, payWith },
        },
      });

      const refreshed = await tx.user.findUnique({
        where: { id: session.user.id },
        select: {
          currency: true,
          gachaTicketsStandard: true,
          gachaTicketsPremium: true,
        },
      });

      return {
        ok: true,
        items: created,
        currency: refreshed?.currency ?? 0,
        cost: payWith === "tickets" ? 0 : starCost,
        payWith,
        gachaTicketsStandard: refreshed?.gachaTicketsStandard ?? 0,
        gachaTicketsPremium: refreshed?.gachaTicketsPremium ?? 0,
      };
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
