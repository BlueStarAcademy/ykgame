import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TITLE_MAX = 80;
const BODY_MAX = 2000;

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.body === "string" ? body.body.trim() : "";

    if (!title || !content) {
      return NextResponse.json({ error: "Missing title or body" }, { status: 400 });
    }
    if (title.length > TITLE_MAX || content.length > BODY_MAX) {
      return NextResponse.json({ error: "Content too long" }, { status: 400 });
    }

    const inquiry = await prisma.customerInquiry.create({
      data: {
        userId: session.user.id,
        title,
        body: content,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ inquiry });
  } catch {
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}
