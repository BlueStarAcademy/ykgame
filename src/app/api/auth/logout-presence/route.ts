import { NextResponse } from "next/server";
import { getTokenSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clearSessionPresence } from "@/lib/session-guard";

export async function POST() {
  try {
    const session = await getTokenSession();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: true });
    }

    const version = session.user.sessionVersion;
    // Only clear presence if this JWT is still the active session
    if (typeof version === "number") {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { sessionVersion: true },
      });
      if (user && user.sessionVersion === version) {
        await clearSessionPresence(session.user.id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth/logout-presence]", error);
    // Best-effort — logout should still proceed on the client
    return NextResponse.json({ ok: true });
  }
}
