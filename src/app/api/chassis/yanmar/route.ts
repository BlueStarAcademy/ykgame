import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureYanmarGearMigration } from "@/games/yanmar/gearMigrate";
import {
  CHASSIS_CATALOG,
  DEFAULT_CHASSIS_ID,
  getChassisDef,
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
    activeId: DEFAULT_CHASSIS_ID,
    ownedIds: result.ownedChassisIds,
    catalog: CHASSIS_CATALOG.filter((c) => c.id === DEFAULT_CHASSIS_ID),
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
          const chassisClass = getChassisDef(DEFAULT_CHASSIS_ID).chassisClass;
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

      // Chassis purchase / equip disabled — ViO17-1 only.
      if (body.action === "purchase" || body.action === "equip") {
        throw new Error("CHASSIS_LOCKED");
      }

      throw new Error("INVALID_ACTION");
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (
      msg !== "INVALID_ALLOC" &&
      msg !== "INVALID_ACTION" &&
      msg !== "INVALID_CHASSIS" &&
      msg !== "CHASSIS_LOCKED"
    ) {
      console.error("[chassis/yanmar]", e);
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
