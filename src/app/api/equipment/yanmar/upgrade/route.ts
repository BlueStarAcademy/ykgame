import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateYanmarEquipmentStats,
  getYanmarUpgradeCost,
  mergeYanmarEquipmentLevelsFromDb,
  YANMAR_EQUIPMENT_CONFIG,
  type YanmarEquipmentPart,
} from "@/games/yanmar/equipment";

function isEquipmentPart(part: unknown): part is YanmarEquipmentPart {
  return (
    typeof part === "string" &&
    Object.prototype.hasOwnProperty.call(YANMAR_EQUIPMENT_CONFIG, part)
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { part } = (await request.json()) as { part?: unknown };
  if (!isEquipmentPart(part)) {
    return NextResponse.json({ error: "Invalid part" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const lockKey = `equipment-upgrade:${session.user.id}:yanmar:${part}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const current = await tx.userEquipmentUpgrade.findUnique({
        where: {
          userId_gameId_part: {
            userId: session.user.id,
            gameId: "yanmar",
            part,
          },
        },
      });
      const currentLevel = current?.level ?? 0;
      const config = YANMAR_EQUIPMENT_CONFIG[part];
      if (currentLevel >= config.maxLevel) throw new Error("MAX_LEVEL");

      const nextLevel = currentLevel + 1;
      const cost = getYanmarUpgradeCost(part, nextLevel);

      const chargedUsers = await tx.$queryRaw<Array<{ currency: number }>>`
        UPDATE "User"
        SET "currency" = "currency" - ${cost}
        WHERE "id" = ${session.user.id}
          AND "currency" >= ${cost}
        RETURNING "currency"
      `;
      const chargedUser = chargedUsers[0];
      if (!chargedUser) throw new Error("NOT_ENOUGH_STARS");

      const updated = await tx.userEquipmentUpgrade.upsert({
        where: {
          userId_gameId_part: {
            userId: session.user.id,
            gameId: "yanmar",
            part,
          },
        },
        create: {
          userId: session.user.id,
          gameId: "yanmar",
          part,
          level: nextLevel,
        },
        update: { level: nextLevel },
      });

      const rows = await tx.userEquipmentUpgrade.findMany({
        where: { userId: session.user.id, gameId: "yanmar" },
        select: { part: true, level: true },
      });
      const levels = mergeYanmarEquipmentLevelsFromDb(rows);

      return {
        upgraded: updated,
        currency: chargedUser.currency,
        levels,
        stats: calculateYanmarEquipmentStats(levels),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UPGRADE_FAILED";
    if (message === "MAX_LEVEL") {
      return NextResponse.json({ error: "Max level reached" }, { status: 400 });
    }
    if (message === "NOT_ENOUGH_STARS") {
      return NextResponse.json({ error: "Not enough stars" }, { status: 400 });
    }
    return NextResponse.json({ error: "Upgrade failed" }, { status: 500 });
  }
}
