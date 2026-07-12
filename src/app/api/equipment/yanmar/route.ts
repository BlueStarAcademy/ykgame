import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateYanmarEquipmentStats,
  getYanmarUpgradeCost,
  mergeYanmarEquipmentFailBonusesFromDb,
  mergeYanmarEquipmentLevelsFromDb,
  type YanmarEquipmentPart,
} from "@/games/yanmar/equipment";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user, rows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { currency: true, totalXp: true },
    }),
    prisma.userEquipmentUpgrade.findMany({
      where: { userId: session.user.id, gameId: "yanmar" },
      select: { part: true, level: true, failBonus: true },
    }),
  ]);

  const levels = mergeYanmarEquipmentLevelsFromDb(rows);
  const failBonuses = mergeYanmarEquipmentFailBonusesFromDb(rows);

  return NextResponse.json({
    currency: user?.currency ?? 0,
    totalXp: user?.totalXp ?? 0,
    levels,
    failBonuses,
    stats: calculateYanmarEquipmentStats(levels),
    costs: Object.fromEntries(
      (Object.keys(levels) as YanmarEquipmentPart[]).map((part) => [
        part,
        getYanmarUpgradeCost(part, levels[part] + 1),
      ]),
    ),
  });
}
