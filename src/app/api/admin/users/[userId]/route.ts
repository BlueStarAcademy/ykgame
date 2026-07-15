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
        enhanceCores: true,
        isActive: true,
        sanctionReason: true,
        sanctionedAt: true,
        createdAt: true,
        _count: {
          select: {
            gameScores: true,
            coupons: true,
            mails: true,
            rewardInventoryItems: true,
            gearItems: true,
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
        gearItems: {
          where: { gameId: "yanmar" },
          orderBy: { updatedAt: "desc" },
          take: 20,
          select: {
            id: true,
            slot: true,
            grade: true,
            enhanceLevel: true,
            nameSnapshot: true,
            durability: true,
            durabilityMax: true,
            equippedSlot: true,
          },
        },
        chassisLoadouts: {
          where: { gameId: "yanmar" },
          take: 1,
          select: {
            activeChassisId: true,
            ownedChassisIds: true,
          },
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
    const { nickname, role, isActive, sanctionReason } = body as {
      nickname?: string;
      role?: "USER" | "ADMIN";
      isActive?: boolean;
      sanctionReason?: string | null;
    };

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

    if (isActive === false) {
      const reason = typeof sanctionReason === "string" ? sanctionReason.trim() : "";
      if (!reason) {
        return NextResponse.json({ error: "Missing sanction reason" }, { status: 400 });
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(nickname !== undefined ? { nickname } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(isActive !== undefined
          ? isActive
            ? {
                isActive: true,
                sanctionReason: null,
                sanctionedAt: null,
              }
            : {
                isActive: false,
                sanctionReason: (sanctionReason as string).trim(),
                sanctionedAt: new Date(),
              }
          : {}),
      },
      select: {
        id: true,
        loginId: true,
        nickname: true,
        role: true,
        isActive: true,
        sanctionReason: true,
        sanctionedAt: true,
      },
    });

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
