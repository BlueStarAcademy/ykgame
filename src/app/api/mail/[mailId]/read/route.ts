import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
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
    select: { id: true, readAt: true },
  });

  if (!mail) {
    return NextResponse.json({ error: "Mail not found" }, { status: 404 });
  }

  if (!mail.readAt) {
    await prisma.userMail.update({
      where: { id: mail.id },
      data: { readAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
