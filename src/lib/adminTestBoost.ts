import type { PrismaClient } from "@/generated/prisma/client";
import { getXpRequiredForLevel } from "@/lib/playerLevel";

/** 관리자 테스트용 조형물·팻말(워크샵) 포인트 목표치 */
export const ADMIN_TEST_POINTS = 999_999;

/** 기념비 만랩(+10) 레벨 게이트(40)까지 포함해 모든 기능 개방 */
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
  monumentPhase: string;
};

/**
 * ADMIN 계정에 테스트용 XP·조형물/팻말 포인트를 채우고 조형물을 active로 연다.
 * 이미 목표치 이상이면 건드리지 않는다.
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
    needsPhase;

  if (!needsUpdate) {
    return {
      totalXp: user.totalXp,
      monumentPoints: user.monumentPoints,
      dumpWorkshopPoints: user.dumpWorkshopPoints,
      crashWorkshopPoints: user.crashWorkshopPoints,
      hillWorkshopPoints: user.hillWorkshopPoints,
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
      monumentPhase: true,
    },
  });

  return updated;
}
