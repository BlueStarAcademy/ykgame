import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  MAX_USER_CURRENCY,
  cappedCurrencyIncrement,
  clampUserCurrency,
} from "@/lib/currency";
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
      mode === "set"
        ? clampUserCurrency(amount)
        : amount >= 0
          ? cappedCurrencyIncrement(user.currency, amount).next
          : clampUserCurrency(user.currency + amount);

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

    const floorAmount = Math.floor(amount);
    const updated = await prisma.$executeRaw`
      UPDATE "User"
      SET currency = LEAST("currency" + ${floorAmount}, ${MAX_USER_CURRENCY})
      WHERE role = 'USER' AND "isActive" = true
    `;

    return NextResponse.json({ updated: Number(updated) });
  } catch {
    return NextResponse.json({ error: "Bulk update failed" }, { status: 500 });
  }
}
