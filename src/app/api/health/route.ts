import { NextResponse } from "next/server";
import { DEPLOY_REV } from "@/lib/deploy-rev";
import { getDatabasePoolStats } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Railway 배포 헬스체크 — rev로 실제 배포 버전 확인 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      rev: DEPLOY_REV,
      dbPool: getDatabasePoolStats(),
    },
    { status: 200 },
  );
}
