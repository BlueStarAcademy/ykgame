import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getQuestAdminReport } from "@/lib/quest-admin-report";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ yanmar: getQuestAdminReport() });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
