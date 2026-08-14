import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { hideChatMessage } from "@/lib/chat/messages";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
    }

    const message = await hideChatMessage({
      messageId: id,
      adminId: admin.user.id,
    });
    if (!message) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status =
      message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
