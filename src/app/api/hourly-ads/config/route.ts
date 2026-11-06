import { NextResponse } from "next/server";
import { getHourlyAdPublicConfig } from "@/lib/hourly-ads";

export async function GET() {
  try {
    const config = await getHourlyAdPublicConfig();
    return NextResponse.json(config, {
      headers: {
        "Cache-Control": "public, max-age=15, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error("[hourly-ads/config] GET failed:", error);
    return NextResponse.json({ error: "Failed to load ads" }, { status: 500 });
  }
}
