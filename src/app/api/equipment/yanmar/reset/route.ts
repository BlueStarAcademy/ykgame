import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/** Legacy equipment reset removed — use /api/gear/yanmar/action dismantle */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    {
      error: "LEGACY_REMOVED",
      message: "부위 강화 초기화는 폐지되었습니다.",
    },
    { status: 410 },
  );
}
