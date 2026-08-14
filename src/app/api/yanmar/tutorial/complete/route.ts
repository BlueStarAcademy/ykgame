import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { asJson } from "@/games/yanmar/jsonCompat";
import {
  parseYanmarTutorialState,
  withCompletedStep,
  type TutorialStepId,
  TUTORIAL_STEP_IDS,
} from "@/games/yanmar/tutorialProgress";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { stepId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const stepId = body.stepId;
  if (
    !stepId ||
    !(TUTORIAL_STEP_IDS as readonly string[]).includes(stepId)
  ) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { yanmarTutorial: true },
  });
  const next = {
    ...withCompletedStep(
      parseYanmarTutorialState(user?.yanmarTutorial),
      stepId as TutorialStepId,
    ),
    introDone: true,
  };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { yanmarTutorial: asJson(next) },
  });

  return NextResponse.json({ ok: true, tutorial: next });
}
