import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Railway 배포 헬스체크 — DB/Prisma 없이 즉시 200 (서버 기동 여부만 확인) */
export async function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
