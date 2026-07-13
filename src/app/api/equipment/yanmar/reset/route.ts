import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  YANMAR_EQUIPMENT_CONFIG,
  calculateYanmarEquipmentStats,
  getYanmarPartResetRefundStars,
  mergeYanmarEquipmentFailBonusesFromDb,
  mergeYanmarEquipmentLevelsFromDb,
  type YanmarEquipmentPart,
} from "@/games/yanmar/equipment";
import { getPlayerLevelProgress } from "@/lib/playerLevel";
import { isYanmarEquipmentPartLocked } from "@/lib/playerUnlocks";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let part: YanmarEquipmentPart;
  try {
    const body = await req.json();
    part = body.part;
    if (!part || !(part in YANMAR_EQUIPMENT_CONFIG)) {
      return NextResponse.json({ error: "Invalid part" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totalXp: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const playerLevel = getPlayerLevelProgress(user.totalXp).level;
  if (isYanmarEquipmentPartLocked(part, playerLevel)) {
    return NextResponse.json({ error: "Attachment locked" }, { status: 403 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.userEquipmentUpgrade.findMany({
        where: { userId: session.user.id, gameId: "yanmar" },
        select: { part: true, level: true, failBonus: true },
      });

      const levels = mergeYanmarEquipmentLevelsFromDb(rows);
      const failBonuses = mergeYanmarEquipmentFailBonusesFromDb(rows);
      const partLevel = levels[part];
      const refundStars = getYanmarPartResetRefundStars(part, partLevel);

      if (partLevel <= 0) {
        const user = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { currency: true },
        });
        if (!user) throw new Error("USER_NOT_FOUND");
        return {
          refundedStars: 0,
          currency: user.currency,
          levels,
          failBonuses: { ...failBonuses, [part]: 0 },
          stats: calculateYanmarEquipmentStats(levels),
        };
      }

      await tx.userEquipmentUpgrade.deleteMany({
        where: { userId: session.user.id, gameId: "yanmar", part },
      });

      const nextLevels = { ...levels, [part]: 0 };
      const nextFailBonuses = { ...failBonuses, [part]: 0 };

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
        levels: nextLevels,
        failBonuses: nextFailBonuses,
        stats: calculateYanmarEquipmentStats(nextLevels),
      };
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
