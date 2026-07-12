import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_MESSAGE_LENGTH = 160;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function normalizeMessage(value: unknown) {
  if (typeof value !== "string") return null;
  const message = value.trim().replace(/\s+/g, " ");
  if (!message || message.length > MAX_MESSAGE_LENGTH) return null;
  return message;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as {
      message?: unknown;
      active?: unknown;
    } | null;

    const data: { message?: string; active?: boolean } = {};
    if (body?.message !== undefined) {
      const message = normalizeMessage(body.message);
      if (!message) {
        return NextResponse.json(
          { error: `공지는 1~${MAX_MESSAGE_LENGTH}자로 입력해주세요.` },
          { status: 400 },
        );
      }
      data.message = message;
    }
    if (typeof body?.active === "boolean") {
      data.active = body.active;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No changes" }, { status: 400 });
    }

    const notice = await prisma.tickerNotice.update({
      where: { id },
      data,
    });
    return NextResponse.json({ notice });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    if (message.includes("Record to update not found")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const status = message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    await prisma.tickerNotice.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    if (message.includes("Record to delete does not exist")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const status = message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}
