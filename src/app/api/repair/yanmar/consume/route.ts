import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureYanmarGearMigration } from "@/games/yanmar/gearMigrate";
import { loadUserFinalStats } from "@/games/yanmar/gearService";
import {
  applyTravelMeters,
  calendarFillDefaults,
} from "@/games/yanmar/maintenance";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { travelMeters?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const travelMeters = Math.max(
    0,
    Math.min(50_000, Number(body.travelMeters) || 0),
  );
  if (travelMeters <= 0) {
    return NextResponse.json({ error: "Invalid travelMeters" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await ensureYanmarGearMigration(tx, session.user.id);
      const now = new Date();

      const repair =
        (await tx.userRepairState.findUnique({
          where: {
            userId_gameId: { userId: session.user.id, gameId: "yanmar" },
          },
        })) ??
        (await tx.userRepairState.create({
          data: {
            userId: session.user.id,
            gameId: "yanmar",
            buffKind: "NONE",
            ...calendarFillDefaults(now),
          },
        }));

      // Backfill calendar start if missing (legacy rows).
      const calendarPatch: Record<string, Date> = {};
      if (!repair.hydraulicOilFilledAt) {
        calendarPatch.hydraulicOilFilledAt = now;
      }
      if (!repair.hydraulicFilterFilledAt) {
        calendarPatch.hydraulicFilterFilledAt = now;
      }
      if (!repair.fuelFilterFilledAt) {
        calendarPatch.fuelFilterFilledAt = now;
      }
      if (!repair.gearOilFilledAt) {
        calendarPatch.gearOilFilledAt = now;
      }

      const travelPatch = applyTravelMeters(repair, travelMeters);

      await tx.userRepairState.update({
        where: { id: repair.id },
        data: { ...travelPatch, ...calendarPatch },
      });

      const next = await loadUserFinalStats(tx, session.user.id);
      return {
        ok: true,
        maintenance: next.maintenance,
        stats: next.stats,
        repair: next.repair,
      };
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
