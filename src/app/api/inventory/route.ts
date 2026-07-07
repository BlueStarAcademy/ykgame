import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user, coupons, rewards] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { currency: true },
    }),
    prisma.userCoupon.findMany({
      where: { userId: session.user.id },
      orderBy: [{ usedAt: "asc" }, { expiresAt: "asc" }],
      select: {
        id: true,
        type: true,
        discountPct: true,
        barcodeCode: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true,
      },
    }),
    prisma.userRewardInventory.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        gameId: true,
        type: true,
        amount: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    currency: user?.currency ?? 0,
    coupons,
    rewards,
  });
}
