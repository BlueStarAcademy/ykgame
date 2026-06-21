import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json(
        { error: "이메일을 입력해주세요." },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    return NextResponse.json({ available: !existing });
  } catch {
    return NextResponse.json(
      { error: "이메일 확인 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
