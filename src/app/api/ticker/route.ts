import { NextResponse } from "next/server";
import { getTickerFeed, getTickerSettings } from "@/lib/ticker";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includePractice = searchParams.get("practice") === "1";

  try {
    const [items, settings] = await Promise.all([
      getTickerFeed({ includePractice }),
      getTickerSettings(),
    ]);
    return NextResponse.json(
      { items, scrollSpeedPx: settings.scrollSpeedPx },
      {
        headers: {
          "Cache-Control": "public, max-age=5, stale-while-revalidate=15",
        },
      },
    );
  } catch (error) {
    console.error("[ticker] feed failed:", error);
    try {
      const items = await getTickerFeed({ includePractice });
      return NextResponse.json(
        { items, scrollSpeedPx: 60 },
        { status: 200 },
      );
    } catch {
      return NextResponse.json(
        { items: [], scrollSpeedPx: 60 },
        { status: 200 },
      );
    }
  }
}
