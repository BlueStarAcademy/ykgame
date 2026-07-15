import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  GEAR_INVENTORY_MAX,
  ITEM_GRADE_LABEL,
} from "@/games/yanmar/gearCatalog";

export async function GET() {
  try {
    await requireAdmin();

    const [gradeGroups, totalGear, totalUsersWithGear, recentPulls, topHolders] =
      await Promise.all([
        prisma.gearItem.groupBy({
          by: ["grade"],
          where: { gameId: "yanmar" },
          _count: { _all: true },
        }),
        prisma.gearItem.count({ where: { gameId: "yanmar" } }),
        prisma.gearItem.findMany({
          where: { gameId: "yanmar" },
          distinct: ["userId"],
          select: { userId: true },
        }),
        prisma.gachaPullLog.findMany({
          where: { gameId: "yanmar" },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            id: true,
            banner: true,
            count: true,
            results: true,
            createdAt: true,
            user: {
              select: { id: true, loginId: true, nickname: true },
            },
          },
        }),
        prisma.gearItem.groupBy({
          by: ["userId"],
          where: { gameId: "yanmar" },
          _count: { _all: true },
          orderBy: { _count: { userId: "desc" } },
          take: 15,
        }),
      ]);

    const holderIds = topHolders.map((h) => h.userId);
    const holders = await prisma.user.findMany({
      where: { id: { in: holderIds } },
      select: {
        id: true,
        loginId: true,
        nickname: true,
        enhanceCores: true,
        currency: true,
      },
    });
    const holderMap = new Map(holders.map((u) => [u.id, u]));

    return NextResponse.json({
      inventoryCap: GEAR_INVENTORY_MAX,
      totalGear,
      usersWithGear: totalUsersWithGear.length,
      byGrade: gradeGroups.map((g) => ({
        grade: g.grade,
        gradeLabel: ITEM_GRADE_LABEL[g.grade],
        count: g._count._all,
      })),
      topHolders: topHolders.map((h) => {
        const user = holderMap.get(h.userId);
        return {
          userId: h.userId,
          loginId: user?.loginId ?? h.userId,
          nickname: user?.nickname ?? null,
          gearCount: h._count._all,
          enhanceCores: user?.enhanceCores ?? 0,
          currency: user?.currency ?? 0,
        };
      }),
      recentPulls: recentPulls.map((p) => ({
        id: p.id,
        banner: p.banner,
        count: p.count,
        createdAt: p.createdAt.toISOString(),
        user: p.user,
        results: p.results,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
