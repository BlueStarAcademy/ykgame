import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  formatStageOrderKo,
  getSportsMeetPattern,
  resolveSportsMeetPatternId,
} from "@/games/yanmar/sportsMeet/patterns";
import {
  getMsUntilNextSportsMeetDayReset,
  getSportsMeetDayKey,
  getSportsMeetWeekKey,
} from "@/games/yanmar/sportsMeet/weekKey";
import { formatSportsMeetRewardTiersKo } from "@/games/yanmar/sportsMeet/weeklyRewards";
import { SPORTS_MEET_MISSION_DEFAULTS } from "@/games/yanmar/sportsMeet/missionBalance";
import { ensurePreviousSportsMeetWeekSettled } from "@/games/yanmar/sportsMeet/settleServer";

const TICKET_LIMIT = 1;

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensurePreviousSportsMeetWeekSettled();

  const dayKey = getSportsMeetDayKey();
  const weekKey = getSportsMeetWeekKey();
  const pattern = getSportsMeetPattern(weekKey);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      sportsMeetDayKey: true,
      sportsMeetAttemptsUsed: true,
      totalXp: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }

  const dayRolled = user.sportsMeetDayKey !== dayKey;
  const used = dayRolled ? 0 : Math.min(TICKET_LIMIT, user.sportsMeetAttemptsUsed);
  if (dayRolled) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { sportsMeetDayKey: dayKey, sportsMeetAttemptsUsed: 0 },
    });
  }

  return NextResponse.json({
    dayKey,
    weekKey,
    patternId: pattern.id,
    patternName: pattern.nameKo,
    stageOrder: pattern.stageOrder,
    stageOrderLabel: formatStageOrderKo(pattern.stageOrder),
    mission: SPORTS_MEET_MISSION_DEFAULTS,
    rewardTiers: formatSportsMeetRewardTiersKo(),
    ticket: {
      limit: TICKET_LIMIT,
      used,
      remaining: Math.max(0, TICKET_LIMIT - used),
      resetInMs: getMsUntilNextSportsMeetDayReset(),
    },
  });
}

/** Consume one ranked challenge ticket for today. */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensurePreviousSportsMeetWeekSettled();

  const dayKey = getSportsMeetDayKey();
  const weekKey = getSportsMeetWeekKey();
  const patternId = resolveSportsMeetPatternId(weekKey);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: session.user.id },
      select: {
        sportsMeetDayKey: true,
        sportsMeetAttemptsUsed: true,
      },
    });
    if (!user) throw new Error("USER_NOT_FOUND");

    const dayRolled = user.sportsMeetDayKey !== dayKey;
    const used = dayRolled ? 0 : user.sportsMeetAttemptsUsed;
    if (used >= TICKET_LIMIT) {
      throw new Error("NO_TICKET");
    }

    await tx.user.update({
      where: { id: session.user.id },
      data: {
        sportsMeetDayKey: dayKey,
        sportsMeetAttemptsUsed: used + 1,
      },
    });

    const runId = `sm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return { runId, remaining: TICKET_LIMIT - (used + 1) };
  });

  return NextResponse.json({
    ok: true,
    dayKey,
    weekKey,
    patternId,
    runId: result.runId,
    ticket: {
      limit: TICKET_LIMIT,
      remaining: result.remaining,
    },
  });
}
