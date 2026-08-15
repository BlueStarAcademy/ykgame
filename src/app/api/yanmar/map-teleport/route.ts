import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAP_TELEPORT_COST = 10;

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const chargedUsers = await prisma.$queryRaw<Array<{ currency: number }>>`
      UPDATE "User"
      SET "currency" = "currency" - ${MAP_TELEPORT_COST}
      WHERE "id" = ${session.user.id}
        AND "currency" >= ${MAP_TELEPORT_COST}
      RETURNING "currency"
    `;
    const chargedUser = chargedUsers[0];
    if (!chargedUser) {
      return NextResponse.json({ error: "INSUFFICIENT_STARS" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, currency: chargedUser.currency });
  } catch {
    return NextResponse.json({ error: "Teleport failed" }, { status: 500 });
  }
}
