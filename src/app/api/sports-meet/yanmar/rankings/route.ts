import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  formatStageOrderKo,
  getSportsMeetPattern,
  resolveSportsMeetPatternId,
} from "@/games/yanmar/sportsMeet/patterns";
import {
  getPreviousSportsMeetWeekKey,
  getSportsMeetWeekKey,
} from "@/games/yanmar/sportsMeet/weekKey";
import { formatSportsMeetRewardTiersKo } from "@/games/yanmar/sportsMeet/weeklyRewards";
import { ensurePreviousSportsMeetWeekSettled } from "@/games/yanmar/sportsMeet/settleServer";

const TOP_N = 100;

export async function GET(request: Request) {
  const session = await auth();
  await ensurePreviousSportsMeetWeekSettled();

  const { searchParams } = new URL(request.url);
  const weekParam = searchParams.get("week") ?? "current";
  const weekKey =
    weekParam === "previous"
      ? getPreviousSportsMeetWeekKey()
      : searchParams.get("weekKey") ?? getSportsMeetWeekKey();

  const isPrevious = weekKey === getPreviousSportsMeetWeekKey();
  const patternId = resolveSportsMeetPatternId(weekKey);
  const pattern = getSportsMeetPattern(weekKey);

  const scores = await prisma.yanmarSportsMeetScore.findMany({
    where: { weekKey },
    orderBy: [{ bestTimeMs: "asc" }, { updatedAt: "asc" }],
    take: TOP_N,
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          loginId: true,
        },
      },
    },
  });

  const rankings = scores.map((row, index) => ({
    rank: index + 1,
    userId: row.userId,
    nickname: row.user.nickname ?? row.user.loginId,
    bestTimeMs: row.bestTimeMs,
    playCount: row.playCount,
  }));

  let myStats: {
    rank: number | null;
    bestTimeMs: number | null;
    playCount: number;
    rewardStars: number | null;
  } | null = null;

  if (session?.user) {
    const mine = await prisma.yanmarSportsMeetScore.findUnique({
      where: {
        userId_weekKey: { userId: session.user.id, weekKey },
      },
    });
    if (mine) {
      const better = await prisma.yanmarSportsMeetScore.count({
        where: {
          weekKey,
          OR: [
            { bestTimeMs: { lt: mine.bestTimeMs } },
            {
              bestTimeMs: mine.bestTimeMs,
              updatedAt: { lt: mine.updatedAt },
            },
          ],
        },
      });
      const rank = better + 1;
      const grant = await prisma.yanmarSportsMeetRewardGrant.findUnique({
        where: {
          userId_weekKey: { userId: session.user.id, weekKey },
        },
      });
      myStats = {
        rank,
        bestTimeMs: mine.bestTimeMs,
        playCount: mine.playCount,
        rewardStars: grant?.stars ?? null,
      };
    } else {
      myStats = {
        rank: null,
        bestTimeMs: null,
        playCount: 0,
        rewardStars: null,
      };
    }
  }

  return NextResponse.json({
    weekKey,
    isPrevious,
    patternId,
    patternName: pattern.nameKo,
    stageOrder: pattern.stageOrder,
    stageOrderLabel: formatStageOrderKo(pattern.stageOrder),
    rewardTiers: formatSportsMeetRewardTiersKo(),
    rankings,
    myStats,
  });
}
