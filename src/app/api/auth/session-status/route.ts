import { NextResponse } from "next/server";
import { getTokenSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { touchSession } from "@/lib/session-guard";

export async function GET() {
  try {
    const session = await getTokenSession();
    if (!session?.user?.id) {
      return NextResponse.json({ status: "unauthenticated" });
    }

    const version = session.user.sessionVersion;
    if (typeof version !== "number") {
      return NextResponse.json({ status: "superseded" });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        sessionVersion: true,
        isActive: true,
        sessionLastSeenAt: true,
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ status: "superseded" });
    }

    if (user.sessionVersion !== version) {
      return NextResponse.json({ status: "superseded" });
    }

    await touchSession(session.user.id, version, {
      lastSeenAt: user.sessionLastSeenAt,
    });
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[auth/session-status]", error);
    return NextResponse.json(
      { error: "세션 확인 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
