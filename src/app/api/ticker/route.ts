import { NextResponse } from "next/server";
import { getTickerFeed } from "@/lib/ticker";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includePractice = searchParams.get("practice") === "1";

  try {
    const items = await getTickerFeed({ includePractice });
    return NextResponse.json(
      { items },
      {
        headers: {
          "Cache-Control": "public, max-age=5, stale-while-revalidate=15",
        },
      },
    );
  } catch (error) {
    console.error("[ticker] feed failed:", error);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
