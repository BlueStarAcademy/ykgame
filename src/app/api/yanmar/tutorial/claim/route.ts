import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { asJson } from "@/games/yanmar/jsonCompat";
import { ensureYanmarGearMigration } from "@/games/yanmar/gearMigrate";
import { grantTutorialReward } from "@/games/yanmar/tutorialReward";
import { loadUserFinalStats } from "@/games/yanmar/gearService";
import {
  parseYanmarTutorialState,
  withClaimedStep,
  hasTutorialReward,
  TUTORIAL_STEP_IDS,
  type TutorialStepId,
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
  const id = stepId as TutorialStepId;
  if (!hasTutorialReward(id)) {
    return NextResponse.json({ error: "NO_REWARD" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await ensureYanmarGearMigration(tx, session.user.id);
      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { yanmarTutorial: true },
      });
      const state = parseYanmarTutorialState(user?.yanmarTutorial);
      if (!state.completed.includes(id)) {
        throw new Error("NOT_COMPLETED");
      }
      if (state.claimed.includes(id)) {
        throw new Error("ALREADY_CLAIMED");
      }

      const grant = await grantTutorialReward(tx, session.user.id, id);
      if (!grant.granted) {
        if (grant.reason === "inventory_full") {
          throw new Error("INVENTORY_FULL");
        }
        throw new Error("NO_REWARD");
      }

      const next = withClaimedStep(state, id);
      await tx.user.update({
        where: { id: session.user.id },
        data: { yanmarTutorial: asJson(next) },
      });

      if (grant.kind === "currency") {
        return {
          ok: true,
          tutorial: next,
          kind: "currency" as const,
          currency: grant.currency,
          enhanceCores: grant.enhanceCores,
          gachaTicketsStandard: grant.gachaTicketsStandard,
          gachaTicketsPremium: grant.gachaTicketsPremium,
          grantedStars: grant.grantedStars,
          grantedEnhanceCores: grant.grantedEnhanceCores,
          grantedGachaTicketsStandard: grant.grantedGachaTicketsStandard,
          grantedGachaTicketsPremium: grant.grantedGachaTicketsPremium,
        };
      }

      const loaded = await loadUserFinalStats(tx, session.user.id);
      return {
        ok: true,
        tutorial: next,
        kind: "gear" as const,
        item: grant.item,
        nameSnapshot: grant.nameSnapshot,
        gradeLabel: grant.gradeLabel,
        slotLabel: grant.slotLabel,
        items: loaded.items,
        stats: loaded.stats,
      };
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    const status =
      msg === "INVENTORY_FULL"
        ? 409
        : msg === "NOT_COMPLETED" || msg === "ALREADY_CLAIMED"
          ? 400
          : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
