import { NextResponse } from "next/server";
import { getOAuthNotReadyMessage, type OAuthProvider } from "@/lib/oauth-stub";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") as OAuthProvider | null;

  if (!provider || !["kakao", "google"].includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  return NextResponse.json({
    ready: false,
    message: getOAuthNotReadyMessage(provider),
  });
}
