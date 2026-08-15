import type { PrismaClient } from "@/generated/prisma/client";
import { getXpRequiredForLevel } from "@/lib/playerLevel";

/** ??? ???? ???·??(???) ??? ??? */
export const ADMIN_TEST_POINTS = 999_999;

/** ??? ??(+10) ?? ???(40)?? ??? ?? ?? ?? */
export const ADMIN_TEST_MIN_LEVEL = 40;

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends" | "$use"
>;

export function totalXpToReachLevel(level: number): number {
  const target = Math.max(1, Math.floor(level));
  let total = 0;
  for (let l = 1; l < target; l++) {
    total += getXpRequiredForLevel(l);
  }
  return total;
}

export type AdminTestBoostSnapshot = {
  totalXp: number;
  monumentPoints: number;
  dumpWorkshopPoints: number;
  crashWorkshopPoints: number;
  hillWorkshopPoints: number;
  floodWorkshopPoints: number;
  monumentPhase: string;
};

/**
 * ADMIN ??? ???? XP·???/?? ???? ??? ???? active? ??.
 * ?? ??? ???? ???? ???.
 */
export async function ensureAdminYanmarTestBoost(
  db: Tx | PrismaClient,
  opts: { userId: string; role: string },
): Promise<AdminTestBoostSnapshot | null> {
  if (opts.role !== "ADMIN") return null;

  const minXp = totalXpToReachLevel(ADMIN_TEST_MIN_LEVEL);
  const user = await db.user.findUnique({
    where: { id: opts.userId },
    select: {
      totalXp: true,
      monumentPoints: true,
      dumpWorkshopPoints: true,
      crashWorkshopPoints: true,
      hillWorkshopPoints: true,
      floodWorkshopPoints: true,
      monumentPhase: true,
      monumentTutorialDone: true,
      monumentProdUpdatedAt: true,
    },
  });
  if (!user) return null;

  const next = {
    totalXp: Math.max(user.totalXp, minXp),
    monumentPoints: Math.max(user.monumentPoints, ADMIN_TEST_POINTS),
    dumpWorkshopPoints: Math.max(user.dumpWorkshopPoints, ADMIN_TEST_POINTS),
    crashWorkshopPoints: Math.max(user.crashWorkshopPoints, ADMIN_TEST_POINTS),
    hillWorkshopPoints: Math.max(user.hillWorkshopPoints, ADMIN_TEST_POINTS),
    floodWorkshopPoints: Math.max(user.floodWorkshopPoints, ADMIN_TEST_POINTS),
    monumentPhase:
      user.monumentPhase === "active" ? user.monumentPhase : "active",
  };

  const needsPhase = user.monumentPhase !== "active";
  const needsUpdate =
    next.totalXp !== user.totalXp ||
    next.monumentPoints !== user.monumentPoints ||
    next.dumpWorkshopPoints !== user.dumpWorkshopPoints ||
    next.crashWorkshopPoints !== user.crashWorkshopPoints ||
    next.hillWorkshopPoints !== user.hillWorkshopPoints ||
    next.floodWorkshopPoints !== user.floodWorkshopPoints ||
    needsPhase;

  if (!needsUpdate) {
    return {
      totalXp: user.totalXp,
      monumentPoints: user.monumentPoints,
      dumpWorkshopPoints: user.dumpWorkshopPoints,
      crashWorkshopPoints: user.crashWorkshopPoints,
      hillWorkshopPoints: user.hillWorkshopPoints,
      floodWorkshopPoints: user.floodWorkshopPoints,
      monumentPhase: user.monumentPhase,
    };
  }

  const updated = await db.user.update({
    where: { id: opts.userId },
    data: {
      totalXp: next.totalXp,
      monumentPoints: next.monumentPoints,
      dumpWorkshopPoints: next.dumpWorkshopPoints,
      crashWorkshopPoints: next.crashWorkshopPoints,
      hillWorkshopPoints: next.hillWorkshopPoints,
      floodWorkshopPoints: next.floodWorkshopPoints,
      monumentPhase: next.monumentPhase,
      ...(needsPhase
        ? {
            monumentTutorialDone: true,
            monumentProdUpdatedAt: user.monumentProdUpdatedAt ?? new Date(),
          }
        : {}),
    },
    select: {
      totalXp: true,
      monumentPoints: true,
      dumpWorkshopPoints: true,
      crashWorkshopPoints: true,
      hillWorkshopPoints: true,
      floodWorkshopPoints: true,
      monumentPhase: true,
    },
  });

  return updated;
}
