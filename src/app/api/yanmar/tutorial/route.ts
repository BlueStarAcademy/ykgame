import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { asJson } from "@/games/yanmar/jsonCompat";
import { getPlayerLevelProgress } from "@/lib/playerLevel";
import {
  grandfatherIntroIfPlayed,
  parseYanmarTutorialState,
  withSeenNew,
  type TutorialStepId,
  type YanmarTutorialState,
} from "@/games/yanmar/tutorialProgress";

async function loadTutorial(
  userId: string,
): Promise<{ state: YanmarTutorialState; totalXp: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { yanmarTutorial: true, totalXp: true },
  });
  const parsed = parseYanmarTutorialState(user?.yanmarTutorial);
  const state = grandfatherIntroIfPlayed(parsed, user?.totalXp ?? 0);
  if (state !== parsed) {
    await prisma.user.update({
      where: { id: userId },
      data: { yanmarTutorial: asJson(state) },
    });
  }
  return { state, totalXp: user?.totalXp ?? 0 };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { state, totalXp } = await loadTutorial(session.user.id);
  return NextResponse.json({
    ok: true,
    tutorial: state,
    playerLevel: getPlayerLevelProgress(totalXp).level,
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { introDone?: boolean; seenNew?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { yanmarTutorial: true, totalXp: true },
  });
  let next = grandfatherIntroIfPlayed(
    parseYanmarTutorialState(user?.yanmarTutorial),
    user?.totalXp ?? 0,
  );
  if (body.introDone === true) {
    next = { ...next, introDone: true };
  }
  if (Array.isArray(body.seenNew)) {
    next = withSeenNew(next, body.seenNew as TutorialStepId[]);
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { yanmarTutorial: asJson(next) },
  });

  return NextResponse.json({ ok: true, tutorial: next });
}
