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
      userId,
      title,
      body: mailBody,
      currencyAmount = 0,
      couponType,
      couponDiscountPct,
    } = body as {
      target?: MailTarget;
      userId?: string;
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
    const isExchangeCoupon = couponType === "FILTER_SET_EXCHANGE";
    const hasCoupon = Boolean(
      couponType &&
        (isExchangeCoupon || (couponDiscountPct != null && couponDiscountPct > 0)),
    );

    if (safeCurrency === 0 && !hasCoupon && !mailBody?.trim()) {
      return NextResponse.json({ error: "No mail content" }, { status: 400 });
    }

    let recipientIds: string[] = [];

    if (userId?.trim()) {
      const user = await prisma.user.findUnique({
        where: { id: userId.trim() },
        select: { id: true, role: true },
      });
      if (!user || user.role === "ADMIN") {
        return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
      }
      recipientIds = [user.id];
    } else {
      const users = await prisma.user.findMany({
        where: {
          role: "USER",
          ...(target === "active" ? { isActive: true } : {}),
        },
        select: { id: true },
      });
      recipientIds = users.map((user) => user.id);
    }

    if (recipientIds.length === 0) {
      return NextResponse.json({ error: "No recipients" }, { status: 400 });
    }

    const mailData = {
      title: title.trim(),
      body: mailBody?.trim() || null,
      currencyAmount: safeCurrency,
      couponType: hasCoupon ? couponType! : null,
      couponDiscountPct: hasCoupon
        ? isExchangeCoupon
          ? 0
          : Math.min(100, Math.floor(couponDiscountPct!))
        : null,
    };

    const result = await prisma.userMail.createMany({
      data: recipientIds.map((id) => ({
        userId: id,
        ...mailData,
      })),
    });

    return NextResponse.json({ sentCount: result.count });
  } catch {
    return NextResponse.json({ error: "Send failed" }, { status: 500 });
  }
}
