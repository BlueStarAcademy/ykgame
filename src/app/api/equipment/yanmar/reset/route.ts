import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_YANMAR_EQUIPMENT_LEVELS,
  calculateYanmarEquipmentStats,
  getYanmarResetRefundStars,
  type YanmarEquipmentPart,
} from "@/games/yanmar/equipment";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.userEquipmentUpgrade.findMany({
        where: { userId: session.user.id, gameId: "yanmar" },
        select: { part: true, level: true },
      });

      const levels = { ...DEFAULT_YANMAR_EQUIPMENT_LEVELS };
      for (const row of rows) {
        levels[row.part as YanmarEquipmentPart] = row.level;
      }

      const refundStars = getYanmarResetRefundStars(levels);

      await tx.userEquipmentUpgrade.deleteMany({
        where: { userId: session.user.id, gameId: "yanmar" },
      });

      const updatedUser =
        refundStars > 0
          ? await tx.user.update({
              where: { id: session.user.id },
              data: { currency: { increment: refundStars } },
              select: { currency: true },
            })
          : await tx.user.findUnique({
              where: { id: session.user.id },
              select: { currency: true },
            });
      if (!updatedUser) throw new Error("USER_NOT_FOUND");

      return {
        refundedStars: refundStars,
        currency: updatedUser.currency,
        levels: { ...DEFAULT_YANMAR_EQUIPMENT_LEVELS },
        stats: calculateYanmarEquipmentStats(DEFAULT_YANMAR_EQUIPMENT_LEVELS),
      };
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
