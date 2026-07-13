import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { InquiryStatus } from "@/generated/prisma/client";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as InquiryStatus | null;

    const inquiries = await prisma.customerInquiry.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            loginId: true,
            nickname: true,
          },
        },
      },
    });

    return NextResponse.json({ inquiries });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
