import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureYanmarGearMigration } from "@/games/yanmar/gearMigrate";
import { loadUserFinalStats } from "@/games/yanmar/gearService";

/**
 * @deprecated Piece durability drain is retired; chassis fluids use /api/repair/yanmar/consume.
 * Kept for compatibility — returns current stats without mutating gear.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.$transaction(async (tx) => {
    await ensureYanmarGearMigration(tx, session.user.id);
    return loadUserFinalStats(tx, session.user.id);
  });

  return NextResponse.json({
    ok: true,
    stats: result.stats,
    items: result.items,
    maintenance: result.maintenance,
  });
}
