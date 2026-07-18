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
import {
  GACHA_FREE_PREMIUM_PER_DAY,
  GACHA_FREE_STANDARD_COOLDOWN_SEC,
  GACHA_FREE_STANDARD_PER_DAY,
  GACHA_FREE_USER_SELECT,
  buildGachaFreeStatus,
  resolveGachaFreeCounters,
  type GachaFreeUserFields,
} from "@/games/yanmar/gachaFree";

function freeFieldsFromUser(user: GachaFreeUserFields): GachaFreeUserFields {
  return {
    gachaFreeDayKey: user.gachaFreeDayKey,
    gachaFreeStandardUsed: user.gachaFreeStandardUsed,
    gachaFreePremiumUsed: user.gachaFreePremiumUsed,
    gachaFreeStandardCooldownAt: user.gachaFreeStandardCooldownAt,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      ...GACHA_FREE_USER_SELECT,
      gachaTicketsStandard: true,
      gachaTicketsPremium: true,
      currency: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    free: buildGachaFreeStatus(freeFieldsFromUser(user)),
    currency: user.currency,
    gachaTicketsStandard: user.gachaTicketsStandard,
    gachaTicketsPremium: user.gachaTicketsPremium,
  });
}

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
  const payWith =
    body.payWith === "tickets"
      ? "tickets"
      : body.payWith === "free"
        ? "free"
        : "stars";
  const cfg = GACHA_CONFIG[banner];
  const starCost = count === 10 ? cfg.cost10 : cfg.cost1;
  const ticketField =
    banner === "PREMIUM" ? "gachaTicketsPremium" : "gachaTicketsStandard";

  if (payWith === "free" && count !== 1) {
    return NextResponse.json(
      { error: "FREE_SINGLE_ONLY" },
      { status: 400 },
    );
  }

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
          ...GACHA_FREE_USER_SELECT,
        },
      });
      if (!user) throw new Error("USER_NOT_FOUND");

      const now = new Date();
      const freeResolved = resolveGachaFreeCounters(
        freeFieldsFromUser(user),
        now,
      );

      if (payWith === "tickets") {
        const tickets =
          banner === "PREMIUM"
            ? user.gachaTicketsPremium
            : user.gachaTicketsStandard;
        if (tickets < count) throw new Error("INSUFFICIENT_TICKETS");
        await tx.user.update({
          where: { id: session.user.id },
          data: {
            [ticketField]: { decrement: count },
            ...(freeResolved.dayRolled
              ? {
                  gachaFreeDayKey: freeResolved.dayKey,
                  gachaFreeStandardUsed: 0,
                  gachaFreePremiumUsed: 0,
                  gachaFreeStandardCooldownAt: null,
                }
              : {}),
          },
        });
      } else if (payWith === "free") {
        if (banner === "STANDARD") {
          if (freeResolved.standardUsed >= GACHA_FREE_STANDARD_PER_DAY) {
            throw new Error("FREE_EXHAUSTED");
          }
          if (
            freeResolved.cooldownAt &&
            freeResolved.cooldownAt.getTime() > now.getTime()
          ) {
            throw new Error("FREE_COOLDOWN");
          }
          await tx.user.update({
            where: { id: session.user.id },
            data: {
              gachaFreeDayKey: freeResolved.dayKey,
              gachaFreeStandardUsed: freeResolved.standardUsed + 1,
              gachaFreePremiumUsed: freeResolved.premiumUsed,
              gachaFreeStandardCooldownAt: new Date(
                now.getTime() + GACHA_FREE_STANDARD_COOLDOWN_SEC * 1000,
              ),
            },
          });
        } else {
          if (freeResolved.premiumUsed >= GACHA_FREE_PREMIUM_PER_DAY) {
            throw new Error("FREE_EXHAUSTED");
          }
          await tx.user.update({
            where: { id: session.user.id },
            data: {
              gachaFreeDayKey: freeResolved.dayKey,
              gachaFreeStandardUsed: freeResolved.standardUsed,
              gachaFreePremiumUsed: freeResolved.premiumUsed + 1,
              gachaFreeStandardCooldownAt: freeResolved.cooldownAt,
            },
          });
        }
      } else {
        if (user.currency < starCost) throw new Error("INSUFFICIENT_STARS");
        await tx.user.update({
          where: { id: session.user.id },
          data: {
            currency: { decrement: starCost },
            ...(freeResolved.dayRolled
              ? {
                  gachaFreeDayKey: freeResolved.dayKey,
                  gachaFreeStandardUsed: 0,
                  gachaFreePremiumUsed: 0,
                  gachaFreeStandardCooldownAt: null,
                }
              : {}),
          },
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
          ...GACHA_FREE_USER_SELECT,
        },
      });
      if (!refreshed) throw new Error("USER_NOT_FOUND");

      return {
        ok: true,
        items: created,
        currency: refreshed.currency,
        cost: payWith === "stars" ? starCost : 0,
        payWith,
        gachaTicketsStandard: refreshed.gachaTicketsStandard,
        gachaTicketsPremium: refreshed.gachaTicketsPremium,
        free: buildGachaFreeStatus(freeFieldsFromUser(refreshed)),
      };
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
