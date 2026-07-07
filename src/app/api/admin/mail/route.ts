import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { CouponType } from "@/generated/prisma/client";

type MailTarget = "all" | "active";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const {
      target = "active",
      title,
      body: mailBody,
      currencyAmount = 0,
      couponType,
      couponDiscountPct,
    } = body as {
      target?: MailTarget;
      title?: string;
      body?: string;
      currencyAmount?: number;
      couponType?: CouponType;
      couponDiscountPct?: number;
    };

    if (!title?.trim()) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    const safeCurrency = Math.max(0, Math.floor(currencyAmount ?? 0));
    const hasCoupon = Boolean(couponType && couponDiscountPct && couponDiscountPct > 0);

    if (safeCurrency === 0 && !hasCoupon && !mailBody?.trim()) {
      return NextResponse.json({ error: "No mail content" }, { status: 400 });
    }

    const users = await prisma.user.findMany({
      where: {
        role: "USER",
        ...(target === "active" ? { isActive: true } : {}),
      },
      select: { id: true },
    });

    if (users.length === 0) {
      return NextResponse.json({ error: "No recipients" }, { status: 400 });
    }

    const result = await prisma.userMail.createMany({
      data: users.map((user) => ({
        userId: user.id,
        title: title.trim(),
        body: mailBody?.trim() || null,
        currencyAmount: safeCurrency,
        couponType: hasCoupon ? couponType : null,
        couponDiscountPct: hasCoupon ? Math.min(100, Math.floor(couponDiscountPct!)) : null,
      })),
    });

    return NextResponse.json({ sentCount: result.count });
  } catch {
    return NextResponse.json({ error: "Send failed" }, { status: 500 });
  }
}
