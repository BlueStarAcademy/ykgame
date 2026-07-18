import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureYanmarGearMigration } from "@/games/yanmar/gearMigrate";
import {
  applyEnhanceFail,
  applyEnhanceSuccess,
  canonicalizeMainOption,
  canonicalizeSubOptions,
  createGearItem,
  getDismantleEnhanceCores,
  getEnhanceCost,
  getEnhanceCoreCost,
  getEnhanceFailBonusAdd,
  getEnhanceSuccessRate,
  pickSlot,
  type GearItemData,
  type MainOptionInst,
  type MasterOptionInst,
} from "@/games/yanmar/gearGenerate";
import {
  GEAR_INVENTORY_BASE,
  GEAR_INVENTORY_EXPAND_STEP,
  GEAR_INVENTORY_MAX,
  GEAR_SLOTS,
  ITEM_GRADE_LABEL,
  SELL_STARS_BY_GRADE,
  clampGearInventorySlots,
  getGearInventoryExpandCost,
  rollSynthesizeResultGrade,
  type GearSlot,
  type ItemGrade,
} from "@/games/yanmar/gearCatalog";
import { loadUserFinalStats } from "@/games/yanmar/gearService";
import { asJson } from "@/games/yanmar/jsonCompat";

function toData(item: {
  slot: string;
  grade: string;
  enhanceLevel: number;
  failBonus: number;
  mainOption: unknown;
  subOptions: unknown;
  masterOption: unknown;
  nameSnapshot: string;
  durability: number;
  durabilityMax: number;
}): GearItemData {
  const slot = item.slot as GearSlot;
  const grade = item.grade as ItemGrade;
  return {
    slot,
    grade,
    enhanceLevel: item.enhanceLevel,
    failBonus: item.failBonus,
    mainOption: canonicalizeMainOption(
      slot,
      grade,
      item.enhanceLevel,
      item.mainOption as MainOptionInst | null,
    ),
    subOptions: canonicalizeSubOptions(item.subOptions),
    masterOption: (item.masterOption as MasterOptionInst | null) ?? null,
    nameSnapshot: item.nameSnapshot,
    durability: item.durability,
    durabilityMax: item.durabilityMax,
  };
}

const ACTIONS = [
  "equip",
  "unequip",
  "enhance",
  "dismantle",
  "expandInventory",
  "synthesize",
  "sell",
] as const;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    action?: string;
    itemId?: string;
    itemIds?: string[];
    slot?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const action = body.action;
  if (!action || !(ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await ensureYanmarGearMigration(tx, session.user.id);

      if (action === "expandInventory") {
        const user = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { currency: true, gearInventorySlots: true },
        });
        if (!user) throw new Error("NOT_FOUND");
        const current = clampGearInventorySlots(
          user.gearInventorySlots ?? GEAR_INVENTORY_BASE,
        );
        const cost = getGearInventoryExpandCost(current);
        if (cost == null) throw new Error("MAX_SLOTS");
        if (user.currency < cost) throw new Error("INSUFFICIENT_STARS");
        const nextSlots = Math.min(
          GEAR_INVENTORY_MAX,
          current + GEAR_INVENTORY_EXPAND_STEP,
        );
        const updated = await tx.user.update({
          where: { id: session.user.id },
          data: {
            currency: { decrement: cost },
            gearInventorySlots: nextSlots,
          },
          select: { currency: true, gearInventorySlots: true },
        });
        return {
          ok: true,
          currency: updated.currency,
          inventorySlots: clampGearInventorySlots(updated.gearInventorySlots),
          expandCost: getGearInventoryExpandCost(updated.gearInventorySlots),
          expandedBy: nextSlots - current,
        };
      }

      if (action === "synthesize") {
        const rawIds = Array.isArray(body.itemIds) ? body.itemIds : [];
        const itemIds = [...new Set(rawIds.filter((id) => typeof id === "string" && id))];
        if (itemIds.length !== 3) throw new Error("NEED_THREE");

        const items = await tx.gearItem.findMany({
          where: {
            id: { in: itemIds },
            userId: session.user.id,
            gameId: "yanmar",
          },
        });
        if (items.length !== 3) throw new Error("NOT_FOUND");
        if (items.some((item) => item.equippedSlot)) throw new Error("EQUIPPED");

        const grade = items[0]!.grade as ItemGrade;
        if (items.some((item) => item.grade !== grade)) {
          throw new Error("GRADE_MISMATCH");
        }

        await tx.gearItem.deleteMany({
          where: {
            id: { in: itemIds },
            userId: session.user.id,
            gameId: "yanmar",
          },
        });

        const resultGrade = rollSynthesizeResultGrade(grade);
        const slot = pickSlot();
        const loadedBefore = await loadUserFinalStats(tx, session.user.id);
        const durabilityMax = loadedBefore.stats.durabilityMaxPerPiece;
        const data = createGearItem(slot, resultGrade, durabilityMax);
        const created = await tx.gearItem.create({
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
        const user = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { currency: true, enhanceCores: true },
        });
        const loaded = await loadUserFinalStats(tx, session.user.id);
        return {
          ok: true,
          item: {
            ...created,
            gradeLabel: ITEM_GRADE_LABEL[created.grade as ItemGrade],
          },
          consumedIds: itemIds,
          resultGrade,
          inputGrade: grade,
          upgraded: resultGrade !== grade,
          currency: user?.currency ?? 0,
          enhanceCores: user?.enhanceCores ?? 0,
          stats: loaded.stats,
        };
      }

      const itemId = body.itemId;
      if (!itemId) throw new Error("MISSING_ITEM");

      const item = await tx.gearItem.findFirst({
        where: { id: itemId, userId: session.user.id, gameId: "yanmar" },
      });
      if (!item) throw new Error("NOT_FOUND");

      if (action === "equip") {
        const slot = (body.slot ?? item.slot) as GearSlot;
        if (!GEAR_SLOTS.includes(slot) || slot !== item.slot) {
          throw new Error("SLOT_MISMATCH");
        }
        await tx.gearItem.updateMany({
          where: {
            userId: session.user.id,
            gameId: "yanmar",
            equippedSlot: slot,
          },
          data: { equippedSlot: null },
        });
        const data = toData(item);
        const updated = await tx.gearItem.update({
          where: { id: item.id },
          data: {
            equippedSlot: slot,
            mainOption: asJson(data.mainOption),
            subOptions: asJson(data.subOptions),
          },
        });
        const loaded = await loadUserFinalStats(tx, session.user.id);
        return { ok: true, item: updated, stats: loaded.stats };
      }

      if (action === "unequip") {
        const updated = await tx.gearItem.update({
          where: { id: item.id },
          data: { equippedSlot: null },
        });
        const loaded = await loadUserFinalStats(tx, session.user.id);
        return { ok: true, item: updated, stats: loaded.stats };
      }

      if (action === "enhance") {
        if (item.enhanceLevel >= 10) throw new Error("MAX_LEVEL");
        const nextLevel = item.enhanceLevel + 1;
        const grade = item.grade as ItemGrade;
        const cost = getEnhanceCost(nextLevel, grade);
        if (cost == null) throw new Error("MAX_LEVEL");
        const coreCost = getEnhanceCoreCost(nextLevel, grade);
        const user = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { currency: true, enhanceCores: true },
        });
        if (!user || user.currency < cost) throw new Error("INSUFFICIENT_STARS");
        if (user.enhanceCores < coreCost) throw new Error("INSUFFICIENT_CORES");

        await tx.user.update({
          where: { id: session.user.id },
          data: {
            currency: { decrement: cost },
            ...(coreCost > 0 ? { enhanceCores: { decrement: coreCost } } : {}),
          },
        });

        const data = toData(item);
        const beforeSnapshot = {
          enhanceLevel: data.enhanceLevel,
          failBonus: data.failBonus,
          mainOption: { ...data.mainOption },
          subOptions: data.subOptions.map((s) => ({ ...s, rolls: [...s.rolls] })),
          masterOption: data.masterOption ? { ...data.masterOption } : null,
          nameSnapshot: data.nameSnapshot,
        };
        const rate = getEnhanceSuccessRate(nextLevel, item.failBonus, grade);
        const success = Math.random() < rate;
        const next = success ? applyEnhanceSuccess(data) : applyEnhanceFail(data);
        const failBonusAdd = success
          ? 0
          : getEnhanceFailBonusAdd(nextLevel, grade);
        const updated = await tx.gearItem.update({
          where: { id: item.id },
          data: {
            enhanceLevel: next.enhanceLevel,
            failBonus: next.failBonus,
            mainOption: asJson(next.mainOption),
            subOptions: asJson(next.subOptions),
            nameSnapshot: next.nameSnapshot,
            masterOption: next.masterOption ? asJson(next.masterOption) : undefined,
          },
        });
        const refreshed = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { currency: true, enhanceCores: true },
        });
        const loaded = await loadUserFinalStats(tx, session.user.id);
        const nextRate = getEnhanceSuccessRate(
          Math.min(10, next.enhanceLevel + 1),
          next.failBonus,
          grade,
        );
        return {
          ok: true,
          success,
          item: updated,
          currency: refreshed?.currency ?? 0,
          enhanceCores: refreshed?.enhanceCores ?? 0,
          stats: loaded.stats,
          successRate: rate,
          cost,
          coreCost,
          before: beforeSnapshot,
          after: {
            enhanceLevel: next.enhanceLevel,
            failBonus: next.failBonus,
            mainOption: next.mainOption,
            subOptions: next.subOptions,
            masterOption: next.masterOption,
            nameSnapshot: next.nameSnapshot,
          },
          failBonusAdd,
          nextSuccessRate: nextRate,
        };
      }

      if (action === "sell") {
        if (item.equippedSlot) throw new Error("EQUIPPED");
        const grade = item.grade as ItemGrade;
        const stars = SELL_STARS_BY_GRADE[grade];
        await tx.gearItem.delete({ where: { id: item.id } });
        const updatedUser = await tx.user.update({
          where: { id: session.user.id },
          data: { currency: { increment: stars } },
          select: { currency: true, enhanceCores: true },
        });
        const loaded = await loadUserFinalStats(tx, session.user.id);
        return {
          ok: true,
          stars,
          currency: updatedUser.currency,
          enhanceCores: updatedUser.enhanceCores,
          stats: loaded.stats,
        };
      }

      // dismantle — 스타 환불 없음, 강화코어만
      if (item.equippedSlot) throw new Error("EQUIPPED");
      const cores = getDismantleEnhanceCores(
        item.grade as ItemGrade,
        item.enhanceLevel,
      );
      await tx.gearItem.delete({ where: { id: item.id } });
      const updatedUser = await tx.user.update({
        where: { id: session.user.id },
        data: {
          enhanceCores: { increment: cores },
        },
        select: { currency: true, enhanceCores: true },
      });
      const loaded = await loadUserFinalStats(tx, session.user.id);
      return {
        ok: true,
        refund: 0,
        cores,
        currency: updatedUser.currency,
        enhanceCores: updatedUser.enhanceCores,
        stats: loaded.stats,
      };
    });

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    const status =
      msg === "NOT_FOUND"
        ? 404
        : msg === "INSUFFICIENT_STARS" ||
            msg === "INSUFFICIENT_CORES" ||
            msg === "EQUIPPED" ||
            msg === "MAX_LEVEL" ||
            msg === "MAX_SLOTS" ||
            msg === "NEED_THREE" ||
            msg === "GRADE_MISMATCH"
          ? 400
          : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
