import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const WORKSHOP_DEFINITIONS = [
  {
    id: "dig",
    gameId: null,
    label: "굴착 작업장",
    shortLabel: "굴착",
    code: "DIG",
    unlockLevel: 1,
    attachment: "버켓",
    mapArea: "128 × 128m Core",
    accent: "amber",
    task: "지정된 굴착 구역에서 토사를 채취",
    rewardRule: "직접 보상 없음 · 하역 완료 시 XP와 보상 확정",
    operationRule: "굴착량은 버켓 적재 후 하역 작업장에서 집계됩니다.",
  },
  {
    id: "dump",
    gameId: "yanmar",
    label: "하역 작업장",
    shortLabel: "하역",
    code: "DUMP",
    unlockLevel: 1,
    attachment: "버켓",
    mapArea: "128 × 128m Core",
    accent: "sky",
    task: "채취한 토사를 덤프트럭에 하역",
    rewardRule: "청크당 XP 200 · 스타 1~3 · 쿠폰 추첨",
    operationRule: "덤프트럭 적재 완료 후 출발 · 기본 10분 후 복귀",
  },
  {
    id: "crash",
    gameId: "yanmar-crash",
    label: "Crash 철거 작업장",
    shortLabel: "Crash",
    code: "CRASH",
    unlockLevel: 10,
    attachment: "브레이커",
    mapArea: "동쪽 확장 192 × 128m",
    accent: "orange",
    task: "3 × 3 아스팔트 타일 파쇄",
    rewardRule: "타일당 XP 1,000 · 스타 5~15 · 점수 350~400(크리티컬 적용)",
    operationRule: "타일 HP 1,000 · 9칸 전부 파쇄 후 5분 뒤 일괄 재생성",
  },
  {
    id: "hill",
    gameId: "yanmar-hill",
    label: "Hill 운반 작업장",
    shortLabel: "Hill",
    code: "HILL",
    unlockLevel: 15,
    attachment: "집게",
    mapArea: "북쪽 확장 192 × 192m",
    accent: "emerald",
    task: "바위 5개를 집어 정상의 운반 트럭에 적재",
    rewardRule: "바위당 점수 90~120(크리티컬 적용) · 스타 7~15 · 쿠폰 추첨",
    operationRule: "트럭 10개 적재 시 출발 · 돌 전부 반출 시 구역 소멸 · 5분 후 재생성",
  },
] as const;

type AggregateRow = {
  gameId: string;
  activityCount: bigint;
  participantCount: bigint;
  starRewardCount: bigint;
  couponCount: bigint;
  starsGranted: bigint;
  xpGranted: bigint;
  scoreGranted: bigint;
};

function metadataNumber(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [aggregateRows, recentRowsByWorkshop] = await Promise.all([
    prisma.$queryRaw<AggregateRow[]>`
      SELECT
        "gameId" AS "gameId",
        COUNT(*)::bigint AS "activityCount",
        COUNT(DISTINCT "userId")::bigint AS "participantCount",
        COUNT(*) FILTER (WHERE "type" = 'STAR')::bigint AS "starRewardCount",
        COUNT(*) FILTER (WHERE "type" = 'COUPON')::bigint AS "couponCount",
        COALESCE(SUM(CASE WHEN "type" = 'STAR' THEN "amount" ELSE 0 END), 0)::bigint
          AS "starsGranted",
        COALESCE(SUM(
          CASE
            WHEN "gameId" = 'yanmar' THEN 200
            WHEN "metadata" ? 'xpGained'
              THEN ("metadata"->>'xpGained')::bigint
            ELSE 0
          END
        ), 0)::bigint AS "xpGranted",
        COALESCE(SUM(
          CASE
            WHEN "metadata" ? 'score'
              THEN ("metadata"->>'score')::bigint
            ELSE 0
          END
        ), 0)::bigint AS "scoreGranted"
      FROM "UserRewardInventory"
      WHERE "gameId" IN ('yanmar', 'yanmar-crash', 'yanmar-hill')
      GROUP BY "gameId"
    `,
    Promise.all(
      WORKSHOP_DEFINITIONS.map((workshop) => {
        if (!workshop.gameId) return Promise.resolve([]);
        return prisma.userRewardInventory.findMany({
          where: { gameId: workshop.gameId },
          orderBy: { createdAt: "desc" },
          take: 15,
          select: {
            id: true,
            type: true,
            amount: true,
            metadata: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                loginId: true,
                nickname: true,
              },
            },
          },
        });
      }),
    ),
  ]);

  const aggregates = new Map(aggregateRows.map((row) => [row.gameId, row]));
  const workshops = WORKSHOP_DEFINITIONS.map((definition, index) => {
    const aggregate = definition.gameId
      ? aggregates.get(definition.gameId)
      : undefined;
    const recent = recentRowsByWorkshop[index].map((row) => ({
      id: row.id,
      type: row.type,
      amount: row.amount,
      score: metadataNumber(row.metadata, "score"),
      xpGained: metadataNumber(row.metadata, "xpGained"),
      eventId: metadataString(row.metadata, "eventId"),
      couponType: metadataString(row.metadata, "couponType"),
      createdAt: row.createdAt.toISOString(),
      user: row.user,
    }));

    return {
      ...definition,
      stats: {
        activityCount: Number(aggregate?.activityCount ?? 0),
        participantCount: Number(aggregate?.participantCount ?? 0),
        starRewardCount: Number(aggregate?.starRewardCount ?? 0),
        couponCount: Number(aggregate?.couponCount ?? 0),
        starsGranted: Number(aggregate?.starsGranted ?? 0),
        xpGranted: Number(aggregate?.xpGranted ?? 0),
        scoreGranted: Number(aggregate?.scoreGranted ?? 0),
      },
      recent,
    };
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    workshops,
  });
}
