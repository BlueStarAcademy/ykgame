import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/** Legacy linear equipment upgrades removed — use /api/gear/yanmar */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    {
      error: "LEGACY_REMOVED",
      message: "부위 선형 강화는 폐지되었습니다. /api/gear/yanmar 를 사용하세요.",
    },
    { status: 410 },
  );
}

export async function POST() {
  return GET();
}
