import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { InquiryStatus } from "@/generated/prisma/client";

const VALID_STATUS = new Set<InquiryStatus>([
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const inquiry = await prisma.customerInquiry.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        body: true,
        status: true,
        adminNote: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            loginId: true,
            nickname: true,
            email: true,
            isActive: true,
          },
        },
      },
    });

    if (!inquiry) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ inquiry });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const { status, adminNote } = body as {
      status?: InquiryStatus;
      adminNote?: string | null;
    };

    if (status != null && !VALID_STATUS.has(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const inquiry = await prisma.customerInquiry.update({
      where: { id },
      data: {
        ...(status != null ? { status } : {}),
        ...(adminNote !== undefined
          ? { adminNote: adminNote?.trim() ? adminNote.trim() : null }
          : {}),
      },
      select: {
        id: true,
        title: true,
        status: true,
        adminNote: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ inquiry });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
