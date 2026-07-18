import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isSessionActive } from "@/lib/session-guard";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      loginId?: unknown;
      password?: unknown;
    };

    const loginId =
      typeof body.loginId === "string" ? body.loginId.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!loginId || !password) {
      return NextResponse.json(
        { error: "아이디와 비밀번호를 입력해 주세요." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { loginId },
      select: {
        id: true,
        passwordHash: true,
        isActive: true,
        sessionVersion: true,
        sessionLastSeenAt: true,
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 },
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 },
      );
    }

    return NextResponse.json({
      conflict: isSessionActive(user),
    });
  } catch (error) {
    console.error("[auth/prelogin]", error);
    return NextResponse.json(
      { error: "로그인 확인 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
