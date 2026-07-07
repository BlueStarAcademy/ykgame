import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mails = await prisma.userMail.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      body: true,
      currencyAmount: true,
      couponType: true,
      couponDiscountPct: true,
      readAt: true,
      claimedAt: true,
      createdAt: true,
    },
  });

  const unreadCount = mails.filter((mail) => !mail.readAt).length;
  const unclaimedCount = mails.filter(
    (mail) =>
      !mail.claimedAt &&
      (mail.currencyAmount > 0 || (mail.couponType && mail.couponDiscountPct)),
  ).length;

  return NextResponse.json({ mails, unreadCount, unclaimedCount });
}
