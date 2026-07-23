import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getSportsMeetPattern,
  resolveSportsMeetPatternId,
} from "@/games/yanmar/sportsMeet/patterns";
import { getSportsMeetWeekKey } from "@/games/yanmar/sportsMeet/weekKey";
import { ensurePreviousSportsMeetWeekSettled } from "@/games/yanmar/sportsMeet/settleServer";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensurePreviousSportsMeetWeekSettled();

  let body: {
    weekKey?: string;
    patternId?: number;
    clearTimeMs?: number;
    runId?: string;
    mode?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (body.mode !== "ranked") {
    return NextResponse.json({ error: "PRACTICE_NOT_SAVED" }, { status: 400 });
  }

  const weekKey = getSportsMeetWeekKey();
  if (body.weekKey && body.weekKey !== weekKey) {
    return NextResponse.json({ error: "WEEK_MISMATCH" }, { status: 400 });
  }

  const patternId = resolveSportsMeetPatternId(weekKey);
  if (
    typeof body.patternId === "number" &&
    body.patternId !== patternId
  ) {
    return NextResponse.json({ error: "PATTERN_MISMATCH" }, { status: 400 });
  }

  const clearTimeMs = Math.round(Number(body.clearTimeMs));
  if (!Number.isFinite(clearTimeMs) || clearTimeMs < 1 || clearTimeMs > 3_600_000) {
    return NextResponse.json({ error: "INVALID_TIME" }, { status: 400 });
  }

  const runId =
    typeof body.runId === "string" && body.runId.length > 0
      ? body.runId.slice(0, 64)
      : null;

  const existing = await prisma.yanmarSportsMeetScore.findUnique({
    where: {
      userId_weekKey: { userId: session.user.id, weekKey },
    },
  });

  if (existing?.lastRunId && runId && existing.lastRunId === runId) {
    return NextResponse.json({
      ok: true,
      weekKey,
      patternId,
      bestTimeMs: existing.bestTimeMs,
      improved: false,
      duplicate: true,
    });
  }

  const improved =
    !existing || clearTimeMs < existing.bestTimeMs;

  const row = await prisma.yanmarSportsMeetScore.upsert({
    where: {
      userId_weekKey: { userId: session.user.id, weekKey },
    },
    create: {
      userId: session.user.id,
      weekKey,
      patternId,
      bestTimeMs: clearTimeMs,
      playCount: 1,
      lastRunId: runId,
    },
    update: {
      patternId,
      bestTimeMs: improved ? clearTimeMs : existing!.bestTimeMs,
      playCount: { increment: 1 },
      lastRunId: runId ?? existing?.lastRunId,
    },
  });

  const pattern = getSportsMeetPattern(weekKey);
  return NextResponse.json({
    ok: true,
    weekKey,
    patternId,
    patternName: pattern.nameKo,
    bestTimeMs: row.bestTimeMs,
    improved,
  });
}
