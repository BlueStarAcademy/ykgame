import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    await requireAdmin();
    const { userId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        loginId: true,
        email: true,
        nickname: true,
        role: true,
        currency: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            gameScores: true,
            coupons: true,
            mails: true,
            rewardInventoryItems: true,
          },
        },
        gameScores: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            gameId: true,
            score: true,
            stars: true,
            playTime: true,
            createdAt: true,
          },
        },
        coupons: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            type: true,
            discountPct: true,
            expiresAt: true,
            usedAt: true,
          },
        },
        equipmentUpgrades: {
          where: { gameId: "yanmar" },
          select: { part: true, level: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    await requireAdmin();
    const { userId } = await params;
    const body = await request.json();
    const { nickname, role, isActive } = body;

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (existing.role === "ADMIN" && isActive === false) {
      return NextResponse.json({ error: "Cannot deactivate admin" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(nickname !== undefined ? { nickname } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      select: {
        id: true,
        loginId: true,
        nickname: true,
        role: true,
        isActive: true,
      },
    });

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
