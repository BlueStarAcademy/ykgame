import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidChatChannel } from "@/lib/chat-constants";

export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const channelRaw = searchParams.get("channel");
    const nickname = searchParams.get("nickname")?.trim() ?? "";
    const includeHidden = searchParams.get("hidden") === "1";
    const take = Math.min(
      200,
      Math.max(1, Number(searchParams.get("limit") ?? 80) || 80),
    );

    const channel =
      channelRaw && channelRaw !== "all" ? Number(channelRaw) : null;

    const messages = await prisma.chatMessage.findMany({
      where: {
        ...(includeHidden ? {} : { hidden: false }),
        ...(channel != null && isValidChatChannel(channel)
          ? { OR: [{ channel }, { channel: null }] }
          : {}),
        ...(nickname
          ? { nickname: { contains: nickname, mode: "insensitive" } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        user: {
          select: {
            id: true,
            loginId: true,
            nickname: true,
            isActive: true,
          },
        },
      },
    });

    return NextResponse.json({ messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status =
      message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
