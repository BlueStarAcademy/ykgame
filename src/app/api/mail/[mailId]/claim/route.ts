import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createBarcodeCode, getCouponExpiresAt } from "@/lib/coupon";
import { getSeasonKey } from "@/lib/games";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ mailId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { mailId } = await params;

  const mail = await prisma.userMail.findFirst({
    where: { id: mailId, userId: session.user.id },
  });

  if (!mail) {
    return NextResponse.json({ error: "Mail not found" }, { status: 404 });
  }

  if (mail.claimedAt) {
    return NextResponse.json({ error: "Already claimed" }, { status: 400 });
  }

  const hasReward =
    mail.currencyAmount > 0 || (mail.couponType && mail.couponDiscountPct);

  if (!hasReward) {
    await prisma.userMail.update({
      where: { id: mail.id },
      data: { readAt: mail.readAt ?? new Date(), claimedAt: new Date() },
    });
    return NextResponse.json({ currency: session.user.currency, claimed: true });
  }

  const expiresAt = getCouponExpiresAt();
  const seasonKey = getSeasonKey();

  const result = await prisma.$transaction(async (tx) => {
    if (mail.currencyAmount > 0) {
      await tx.user.update({
        where: { id: session.user.id },
        data: { currency: { increment: mail.currencyAmount } },
      });
    }

    if (mail.couponType && mail.couponDiscountPct) {
      await tx.userCoupon.create({
        data: {
          userId: session.user.id,
          type: mail.couponType,
          discountPct: mail.couponDiscountPct,
          barcodeCode: createBarcodeCode(),
          seasonKey,
          fromGameDrop: false,
          expiresAt,
        },
      });
    }

    await tx.userMail.update({
      where: { id: mail.id },
      data: {
        readAt: mail.readAt ?? new Date(),
        claimedAt: new Date(),
      },
    });

    const user = await tx.user.findUnique({
      where: { id: session.user.id },
      select: { currency: true },
    });

    return { currency: user?.currency ?? 0 };
  });

  return NextResponse.json({ currency: result.currency, claimed: true });
}
