import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  SHOP_ITEM_BY_ID,
  isShopItemId,
} from "@/games/yanmar/shopCatalog";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    itemId?: unknown;
  } | null;
  if (!isShopItemId(body?.itemId)) {
    return NextResponse.json({ error: "Invalid item" }, { status: 400 });
  }

  const item = SHOP_ITEM_BY_ID[body.itemId];
  const cost = item.priceStars;

  try {
    const chargedUsers = await prisma.$queryRaw<Array<{ currency: number }>>`
      UPDATE "User"
      SET "currency" = "currency" - ${cost}
      WHERE "id" = ${session.user.id}
        AND "currency" >= ${cost}
      RETURNING "currency"
    `;
    const chargedUser = chargedUsers[0];
    if (!chargedUser) {
      return NextResponse.json({ error: "INSUFFICIENT_STARS" }, { status: 400 });
    }

    const expiresAt = Date.now() + item.durationMs;
    return NextResponse.json({
      itemId: item.id,
      durationMs: item.durationMs,
      expiresAt,
      currency: chargedUser.currency,
    });
  } catch {
    return NextResponse.json({ error: "Purchase failed" }, { status: 500 });
  }
}
