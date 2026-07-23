import { NextResponse } from "next/server";
import { ensurePreviousSportsMeetWeekSettled } from "@/games/yanmar/sportsMeet/settleServer";

/**
 * Weekly sports-meet settlement cron.
 * Target: shortly after Monday 00:00 KST (= Sunday 15:00 UTC).
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 * Fallback (dev): Bearer <AUTH_SECRET> when CRON_SECRET unset.
 */
function authorizeCron(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim() ?? "";
  if (!token) return false;
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && token === cronSecret) return true;
  // Local/dev convenience when CRON_SECRET is not configured.
  if (!cronSecret) {
    const authSecret =
      process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
    if (authSecret && token === authSecret) return true;
  }
  return false;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await ensurePreviousSportsMeetWeekSettled();
  return NextResponse.json({
    ok: true,
    ...result,
    at: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  return GET(request);
}
