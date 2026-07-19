import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { cappedCurrencyIncrement } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { ensureYanmarGearMigration } from "@/games/yanmar/gearMigrate";
import { loadUserFinalStats } from "@/games/yanmar/gearService";
import {
  MAINTENANCE_CLAIM_BUFF,
  MAINTENANCE_FLUIDS,
  MAINTENANCE_REWARDS,
  buildServiceUpdate,
  calendarFillDefaults,
  computeMaintenanceSnapshot,
  isFluidExchangeReady,
  isMaintenanceFluidId,
  mergeRewards,
  missingFilledAtPatch,
  pointKindUserField,
  rollMaintenanceBonus,
  type MaintenanceBonusOutcome,
  type MaintenanceFluidId,
  type MaintenanceReward,
} from "@/games/yanmar/maintenance";

async function grantMaintenancePayout(
  tx: Prisma.TransactionClient,
  userId: string,
  fluidId: MaintenanceFluidId,
  guaranteed: MaintenanceReward,
  bonus: MaintenanceBonusOutcome,
) {
  const merged = mergeRewards(guaranteed, bonus);
  const pointField = pointKindUserField(MAINTENANCE_FLUIDS[fluidId].pointKind);

  const current = await tx.user.findUnique({
    where: { id: userId },
    select: { currency: true, totalXp: true },
  });
  const starCap = cappedCurrencyIncrement(
    current?.currency ?? 0,
    merged.stars,
  );

  const user = await tx.user.update({
    where: { id: userId },
    data: {
      ...(starCap.granted > 0 ? { currency: starCap.next } : {}),
      ...(merged.enhanceCores > 0
        ? { enhanceCores: { increment: merged.enhanceCores } }
        : {}),
      ...(merged.gachaTicketsStandard > 0
        ? {
            gachaTicketsStandard: {
              increment: merged.gachaTicketsStandard,
            },
          }
        : {}),
      ...(merged.gachaTicketsPremium > 0
        ? {
            gachaTicketsPremium: {
              increment: merged.gachaTicketsPremium,
            },
          }
        : {}),
      ...(merged.workshopPoints > 0
        ? { [pointField]: { increment: merged.workshopPoints } }
        : {}),
      ...(merged.xpGarnish > 0
        ? { totalXp: { increment: merged.xpGarnish } }
        : {}),
    },
    select: {
      currency: true,
      enhanceCores: true,
      gachaTicketsStandard: true,
      gachaTicketsPremium: true,
      dumpWorkshopPoints: true,
      crashWorkshopPoints: true,
      hillWorkshopPoints: true,
      monumentPoints: true,
      totalXp: true,
    },
  });

  return {
    user,
    granted: {
      stars: starCap.granted,
      enhanceCores: merged.enhanceCores,
      gachaTicketsStandard: merged.gachaTicketsStandard,
      gachaTicketsPremium: merged.gachaTicketsPremium,
      workshopPoints: merged.workshopPoints,
      pointKind: MAINTENANCE_FLUIDS[fluidId].pointKind,
      xpGarnish: merged.xpGarnish,
    },
  };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { fluid?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const fluid = body.fluid;
  if (!fluid || !isMaintenanceFluidId(fluid)) {
    return NextResponse.json({ error: "Invalid fluid" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await ensureYanmarGearMigration(tx, session.user.id);
      const now = new Date();
      const nowMs = now.getTime();

      let repair =
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

      const fillPatch = missingFilledAtPatch(repair, now);
      if (Object.keys(fillPatch).length > 0) {
        repair = await tx.userRepairState.update({
          where: { id: repair.id },
          data: fillPatch,
        });
      }

      const snapshot = computeMaintenanceSnapshot(repair, nowMs);
      const fluidSnap = snapshot.fluids[fluid];
      if (!isFluidExchangeReady(fluidSnap)) {
        const err = new Error("NOT_READY") as Error & {
          maintenance: typeof snapshot;
          repair: typeof repair;
          serverNow: number;
        };
        err.maintenance = snapshot;
        err.repair = repair;
        err.serverNow = nowMs;
        throw err;
      }

      const guaranteed = MAINTENANCE_REWARDS[fluid];
      const bonus = rollMaintenanceBonus(fluid);
      const claimBuff = MAINTENANCE_CLAIM_BUFF[fluid];
      const serviceData = buildServiceUpdate(fluid, now);

      await tx.userRepairState.update({
        where: { id: repair.id },
        data: {
          ...serviceData,
          buffKind: claimBuff.kind,
          buffExpiresAt: new Date(nowMs + claimBuff.durationMs),
        },
      });

      const payout = await grantMaintenancePayout(
        tx,
        session.user.id,
        fluid,
        guaranteed,
        bonus,
      );

      const next = await loadUserFinalStats(tx, session.user.id);
      return {
        ok: true,
        currency: payout.user.currency,
        enhanceCores: payout.user.enhanceCores,
        gachaTicketsStandard: payout.user.gachaTicketsStandard,
        gachaTicketsPremium: payout.user.gachaTicketsPremium,
        dumpWorkshopPoints: payout.user.dumpWorkshopPoints,
        crashWorkshopPoints: payout.user.crashWorkshopPoints,
        hillWorkshopPoints: payout.user.hillWorkshopPoints,
        monumentPoints: payout.user.monumentPoints,
        repair: next.repair,
        maintenance: next.maintenance,
        stats: next.stats,
        items: next.items,
        serverNow: Date.now(),
        reward: {
          guaranteed,
          bonus,
          buff: claimBuff,
          granted: payout.granted,
        },
      };
    });
    return NextResponse.json(result);
  } catch (e) {
    const err = e as Error & {
      maintenance?: unknown;
      repair?: unknown;
      serverNow?: number;
    };
    const msg = err instanceof Error ? err.message : "ERROR";
    if (msg === "NOT_READY") {
      return NextResponse.json(
        {
          error: "NOT_READY",
          maintenance: err.maintenance ?? null,
          repair: err.repair ?? null,
          serverNow: err.serverNow ?? Date.now(),
        },
        { status: 409 },
      );
    }
    console.error("[repair/yanmar]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
