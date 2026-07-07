import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_YANMAR_EQUIPMENT_LEVELS,
  calculateYanmarEquipmentStats,
  getYanmarUpgradeCost,
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
      select: { currency: true },
    }),
    prisma.userEquipmentUpgrade.findMany({
      where: { userId: session.user.id, gameId: "yanmar" },
      select: { part: true, level: true },
    }),
  ]);

  const levels = { ...DEFAULT_YANMAR_EQUIPMENT_LEVELS };
  for (const row of rows) {
    levels[row.part as YanmarEquipmentPart] = row.level;
  }

  return NextResponse.json({
    currency: user?.currency ?? 0,
    levels,
    stats: calculateYanmarEquipmentStats(levels),
    costs: Object.fromEntries(
      (Object.keys(levels) as YanmarEquipmentPart[]).map((part) => [
        part,
        getYanmarUpgradeCost(part, levels[part] + 1),
      ]),
    ),
  });
}
