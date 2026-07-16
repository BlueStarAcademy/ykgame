import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureYanmarGearMigration } from "@/games/yanmar/gearMigrate";
import {
  CHASSIS_CATALOG,
  getChassisDef,
  isChassisUnlockedForPurchase,
  parseOwnedChassisIds,
  type ChassisModelId,
} from "@/games/yanmar/chassisCatalog";
import { getPlayerLevelProgress } from "@/lib/playerLevel";
import { loadUserFinalStats } from "@/games/yanmar/gearService";
import {
  emptyAbilityAlloc,
  recommendAbilityAlloc,
  sanitizeAbilityAlloc,
} from "@/games/yanmar/abilityAlloc";
import { asJson } from "@/games/yanmar/jsonCompat";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await prisma.$transaction(async (tx) => {
    await ensureYanmarGearMigration(tx, session.user.id);
    return loadUserFinalStats(tx, session.user.id);
  });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currency: true, totalXp: true },
  });
  const level = getPlayerLevelProgress(user?.totalXp ?? 0).level;
  return NextResponse.json({
    currency: user?.currency ?? 0,
    playerLevel: level,
    activeId: result.loadout?.activeChassisId ?? "ViO17_1",
    ownedIds: result.ownedChassisIds,
    catalog: CHASSIS_CATALOG,
    stats: result.stats,
    abilityAlloc: result.abilityAlloc,
    abilityPoints: result.abilityPoints,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: {
    action?: string;
    chassisId?: string;
    alloc?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await ensureYanmarGearMigration(tx, session.user.id);

      if (
        body.action === "allocate" ||
        body.action === "resetAlloc" ||
        body.action === "recommendAlloc"
      ) {
        const user = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { totalXp: true },
        });
        if (!user) throw new Error("USER_NOT_FOUND");
        const level = getPlayerLevelProgress(user.totalXp).level;
        const loadout = await tx.userChassisLoadout.findUnique({
          where: { userId_gameId: { userId: session.user.id, gameId: "yanmar" } },
        });
        if (!loadout) throw new Error("LOADOUT_NOT_FOUND");

        let nextAlloc = emptyAbilityAlloc();
        if (body.action === "allocate") {
          const sanitized = sanitizeAbilityAlloc(body.alloc, level);
          if (!sanitized) throw new Error("INVALID_ALLOC");
          nextAlloc = sanitized;
        } else if (body.action === "recommendAlloc") {
          const activeId = (loadout.activeChassisId ?? "ViO17_1") as ChassisModelId;
          const chassisClass = getChassisDef(activeId).chassisClass;
          nextAlloc = recommendAbilityAlloc(level, chassisClass);
        }

        await tx.userChassisLoadout.update({
          where: { userId_gameId: { userId: session.user.id, gameId: "yanmar" } },
          data: { abilityAlloc: asJson(nextAlloc) },
        });
        const loaded = await loadUserFinalStats(tx, session.user.id);
        return {
          ok: true,
          abilityAlloc: loaded.abilityAlloc,
          abilityPoints: loaded.abilityPoints,
          stats: loaded.stats,
        };
      }

      const chassisId = body.chassisId as ChassisModelId;
      const def = getChassisDef(chassisId);
      if (def.id !== chassisId) throw new Error("INVALID_CHASSIS");

      const loadout = await tx.userChassisLoadout.findUnique({
        where: { userId_gameId: { userId: session.user.id, gameId: "yanmar" } },
      });
      const owned = parseOwnedChassisIds(loadout?.ownedChassisIds);

      if (body.action === "purchase") {
        if (def.granted) throw new Error("ALREADY_OWNED");
        if (owned.includes(def.id)) throw new Error("ALREADY_OWNED");
        const user = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { currency: true, totalXp: true },
        });
        if (!user) throw new Error("USER_NOT_FOUND");
        const level = getPlayerLevelProgress(user.totalXp).level;
        if (!isChassisUnlockedForPurchase(def, level)) {
          throw new Error("LOCKED");
        }
        if (user.currency < def.priceStars) throw new Error("INSUFFICIENT_STARS");
        const nextOwned = [...owned, def.id];
        await tx.user.update({
          where: { id: session.user.id },
          data: { currency: { decrement: def.priceStars } },
        });
        await tx.userChassisLoadout.update({
          where: { userId_gameId: { userId: session.user.id, gameId: "yanmar" } },
          data: { ownedChassisIds: nextOwned },
        });
        const refreshed = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { currency: true },
        });
        return {
          ok: true,
          ownedIds: nextOwned,
          currency: refreshed?.currency ?? 0,
          purchased: def.id,
        };
      }

      if (body.action === "equip") {
        if (!owned.includes(def.id)) throw new Error("NOT_OWNED");
        await tx.userChassisLoadout.update({
          where: { userId_gameId: { userId: session.user.id, gameId: "yanmar" } },
          data: { activeChassisId: def.id },
        });
        const loaded = await loadUserFinalStats(tx, session.user.id);
        const nextMax = loaded.stats.durabilityMaxPerPiece;
        const pieces = await tx.gearItem.findMany({
          where: { userId: session.user.id, gameId: "yanmar" },
          select: { id: true, durability: true, durabilityMax: true },
        });
        for (const piece of pieces) {
          if (piece.durabilityMax === nextMax) continue;
          const ratio =
            piece.durabilityMax > 0
              ? piece.durability / piece.durabilityMax
              : 1;
          await tx.gearItem.update({
            where: { id: piece.id },
            data: {
              durabilityMax: nextMax,
              durability: Math.min(nextMax, Math.max(0, ratio * nextMax)),
            },
          });
        }
        const refreshed = await loadUserFinalStats(tx, session.user.id);
        return {
          ok: true,
          activeId: def.id,
          stats: refreshed.stats,
          abilityAlloc: refreshed.abilityAlloc,
          abilityPoints: refreshed.abilityPoints,
        };
      }

      throw new Error("INVALID_ACTION");
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
