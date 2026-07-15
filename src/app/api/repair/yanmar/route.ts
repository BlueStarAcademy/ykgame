import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureYanmarGearMigration } from "@/games/yanmar/gearMigrate";
import { loadUserFinalStats } from "@/games/yanmar/gearService";
import {
  PREMIUM_REPAIR_BUFF_MS,
  TOP_REPAIR_BUFF_MS,
  buildServiceUpdate,
  calendarFillDefaults,
  computeMaintenanceSnapshot,
  getFluidFreeAvailableAt,
  isMaintenanceFluidId,
  repairCost,
  type MaintenanceRepairKind,
} from "@/games/yanmar/maintenance";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { fluid?: string; kind?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const fluid = body.fluid;
  const kind = body.kind as MaintenanceRepairKind | undefined;
  if (!fluid || !isMaintenanceFluidId(fluid)) {
    return NextResponse.json({ error: "Invalid fluid" }, { status: 400 });
  }
  if (kind !== "free" && kind !== "premium" && kind !== "top") {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await ensureYanmarGearMigration(tx, session.user.id);
      const now = new Date();
      const nowMs = now.getTime();

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

      const snapshot = computeMaintenanceSnapshot(repair, nowMs);
      if (snapshot.fluids[fluid].percent >= 100) {
        throw new Error("FULL");
      }

      if (kind === "free") {
        const freeAt = getFluidFreeAvailableAt(repair, fluid);
        if (freeAt) {
          const freeMs =
            typeof freeAt === "string"
              ? new Date(freeAt).getTime()
              : freeAt.getTime();
          if (Number.isFinite(freeMs) && freeMs > nowMs) {
            throw new Error("COOLDOWN");
          }
        }
      } else {
        const cost = repairCost(kind);
        const user = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { currency: true },
        });
        if (!user || user.currency < cost) throw new Error("INSUFFICIENT_STARS");
        await tx.user.update({
          where: { id: session.user.id },
          data: { currency: { decrement: cost } },
        });
      }

      const serviceData = buildServiceUpdate(fluid, kind, now);
      const buffData =
        kind === "premium"
          ? {
              buffKind: "SMALL" as const,
              buffExpiresAt: new Date(nowMs + PREMIUM_REPAIR_BUFF_MS),
            }
          : kind === "top"
            ? {
                buffKind: "LARGE" as const,
                buffExpiresAt: new Date(nowMs + TOP_REPAIR_BUFF_MS),
              }
            : {};

      await tx.userRepairState.update({
        where: { id: repair.id },
        data: { ...serviceData, ...buffData },
      });

      const refreshed = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { currency: true },
      });
      const next = await loadUserFinalStats(tx, session.user.id);
      return {
        ok: true,
        currency: refreshed?.currency ?? 0,
        repair: next.repair,
        maintenance: next.maintenance,
        stats: next.stats,
        items: next.items,
      };
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
