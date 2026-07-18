import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createBarcodeCode, getCouponExpiresAt } from "@/lib/coupon";
import { cappedCurrencyIncrement } from "@/lib/currency";
import { getSeasonKey } from "@/lib/games";
import { mutatedExactlyOne } from "@/lib/atomic-mutation";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ mailId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { mailId } = await params;
  const expiresAt = getCouponExpiresAt();
  const seasonKey = getSeasonKey();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const mail = await tx.userMail.findFirst({
        where: { id: mailId, userId: session.user.id },
      });

      if (!mail) throw new Error("MAIL_NOT_FOUND");

      const claim = await tx.userMail.updateMany({
        where: {
          id: mail.id,
          userId: session.user.id,
          claimedAt: null,
        },
        data: {
          readAt: mail.readAt ?? new Date(),
          claimedAt: new Date(),
        },
      });

      if (!mutatedExactlyOne(claim.count)) throw new Error("ALREADY_CLAIMED");

      if (mail.currencyAmount > 0) {
        const current = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { currency: true },
        });
        const { next } = cappedCurrencyIncrement(
          current?.currency ?? 0,
          mail.currencyAmount,
        );
        await tx.user.update({
          where: { id: session.user.id },
          data: { currency: next },
        });
      }

      if (mail.couponType) {
        await tx.userCoupon.create({
          data: {
            userId: session.user.id,
            type: mail.couponType,
            discountPct:
              mail.couponType === "FILTER_SET_EXCHANGE"
                ? 0
                : (mail.couponDiscountPct ?? 0),
            barcodeCode: createBarcodeCode(),
            seasonKey,
            fromGameDrop: false,
            expiresAt,
          },
        });
      }

      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { currency: true },
      });

      return { currency: user?.currency ?? 0 };
    });

    return NextResponse.json({ currency: result.currency, claimed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CLAIM_FAILED";
    if (message === "MAIL_NOT_FOUND") {
      return NextResponse.json({ error: "Mail not found" }, { status: 404 });
    }
    if (message === "ALREADY_CLAIMED") {
      return NextResponse.json({ error: "Already claimed" }, { status: 400 });
    }
    return NextResponse.json({ error: "Claim failed" }, { status: 500 });
  }
}
