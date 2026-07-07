import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getGameProbabilityReport } from "@/lib/game-probability";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(getGameProbabilityReport());
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
