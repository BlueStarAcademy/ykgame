import { prisma } from "@/lib/prisma";
import {
  getPreviousSportsMeetWeekKey,
  getSportsMeetWeekKey,
} from "@/games/yanmar/sportsMeet/weekKey";
import { sportsMeetStarsForRank } from "@/games/yanmar/sportsMeet/weeklyRewards";

/**
 * Settle previous week's sports-meet rankings into UserMail rewards.
 * Idempotent per weekKey via YanmarSportsMeetWeekSettlement.
 */
export async function ensurePreviousSportsMeetWeekSettled(now = new Date()) {
  const prevWeekKey = getPreviousSportsMeetWeekKey(now);
  const currentWeekKey = getSportsMeetWeekKey(now);
  if (prevWeekKey === currentWeekKey) {
    return { settled: false, weekKey: prevWeekKey, reason: "same_week" as const };
  }

  const existing = await prisma.yanmarSportsMeetWeekSettlement.findUnique({
    where: { weekKey: prevWeekKey },
  });
  if (existing) {
    return {
      settled: false,
      weekKey: prevWeekKey,
      reason: "already_settled" as const,
    };
  }

  try {
    await prisma.yanmarSportsMeetWeekSettlement.create({
      data: { weekKey: prevWeekKey, participantCount: 0 },
    });
  } catch {
    // Unique race — another request is settling / already settled.
    return {
      settled: false,
      weekKey: prevWeekKey,
      reason: "race" as const,
    };
  }

  const scores = await prisma.yanmarSportsMeetScore.findMany({
    where: { weekKey: prevWeekKey },
    orderBy: [{ bestTimeMs: "asc" }, { updatedAt: "asc" }],
    select: { userId: true, bestTimeMs: true },
  });

  let granted = 0;
  for (let i = 0; i < scores.length; i++) {
    const rank = i + 1;
    const stars = sportsMeetStarsForRank(rank);
    const row = scores[i]!;
    if (stars <= 0) continue;

    const already = await prisma.yanmarSportsMeetRewardGrant.findUnique({
      where: {
        userId_weekKey: { userId: row.userId, weekKey: prevWeekKey },
      },
    });
    if (already) continue;

    const mail = await prisma.userMail.create({
      data: {
        userId: row.userId,
        title: "굴착기 운동회 주간 보상",
        body: `${prevWeekKey} 주차 ${rank}위 기록으로 ${stars.toLocaleString()} 스타가 지급됩니다. 우편에서 수령하세요.`,
        currencyAmount: stars,
      },
    });

    await prisma.yanmarSportsMeetRewardGrant.create({
      data: {
        userId: row.userId,
        weekKey: prevWeekKey,
        rank,
        stars,
        mailId: mail.id,
      },
    });
    granted += 1;
  }

  await prisma.yanmarSportsMeetWeekSettlement.update({
    where: { weekKey: prevWeekKey },
    data: { participantCount: scores.length },
  });

  return {
    settled: true,
    weekKey: prevWeekKey,
    participantCount: scores.length,
    granted,
  };
}
