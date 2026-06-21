import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Railway 배포 헬스체크 — HTTP 서버 기동 여부만 확인 (항상 200) */
export async function GET() {
  let db: "ok" | "error" = "error";

  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "ok";
  } catch {
    // DB 미연결 시에도 배포 헬스체크는 통과 — 앱 프로세스는 기동됨
  }

  return NextResponse.json({ status: "ok", db });
}
