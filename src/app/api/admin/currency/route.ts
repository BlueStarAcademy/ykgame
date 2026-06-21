import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { userId, amount, mode } = body as {
      userId?: string;
      amount?: number;
      mode?: "set" | "add";
    };

    if (!userId || amount === undefined) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const newCurrency =
      mode === "set" ? Math.max(0, amount) : Math.max(0, user.currency + amount);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { currency: newCurrency },
      select: { id: true, loginId: true, nickname: true, currency: true },
    });

    return NextResponse.json({ user: updated });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { amount } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const result = await prisma.user.updateMany({
      where: { role: "USER", isActive: true },
      data: { currency: { increment: amount } },
    });

    return NextResponse.json({ updated: result.count });
  } catch {
    return NextResponse.json({ error: "Bulk update failed" }, { status: 500 });
  }
}
