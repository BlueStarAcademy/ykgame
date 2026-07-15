import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureYanmarGearMigration } from "@/games/yanmar/gearMigrate";
import {
  loadUserFinalStats,
  serializeWorkGearDrop,
  tryWorkEnhanceCoresDrop,
  tryWorkGearDrop,
} from "@/games/yanmar/gearService";
import {
  parseRewardEventId,
  runReplayableRewardEvent,
} from "@/lib/yanmar-rewards";

const GAME_ID = "yanmar-truck-full";

/**
 * 덤프/돌트럭 만재 시 마스터 옵션 점수 + 장비 드롭.
 * body: { eventId, kind: "dump" | "haul" }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    eventId?: unknown;
    kind?: unknown;
  } | null;
  const eventId = parseRewardEventId(body?.eventId);
  const kind = body?.kind === "haul" ? "haul" : body?.kind === "dump" ? "dump" : null;
  if (!eventId || !kind) {
    return NextResponse.json(
      { error: "eventId and kind (dump|haul) required" },
      { status: 400 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    await ensureYanmarGearMigration(tx, session.user.id);
    return runReplayableRewardEvent(
      tx,
      { userId: session.user.id, gameId: `${GAME_ID}-${kind}`, eventId },
      async () => {
        const loaded = await loadUserFinalStats(tx, session.user.id);
        const masters = loaded.stats.activeMasters;
        const scoreOpt =
          kind === "dump"
            ? masters.dumpTruckFullScore
            : masters.haulTruckFullScore;
        const bonusScore = scoreOpt ? Math.round(scoreOpt.value) : 0;

        const gearDrop = serializeWorkGearDrop(
          await tryWorkGearDrop(
            tx,
            session.user.id,
            kind === "dump" ? "dumpTruckFull" : "haulTruckFull",
          ),
        );
        const coreDrop = await tryWorkEnhanceCoresDrop(
          tx,
          session.user.id,
          kind === "dump" ? "dumpTruckFull" : "haulTruckFull",
        );

        if (bonusScore > 0) {
          await tx.userRewardInventory.create({
            data: {
              userId: session.user.id,
              gameId: "yanmar",
              type: "STAR",
              amount: 0,
              metadata: {
                kind: "truck_full_score",
                truck: kind,
                score: bonusScore,
                eventId,
              },
            },
          });
        }

        return {
          eventId,
          kind,
          bonusScore,
          gearDrop,
          coresDropped: coreDrop.dropped ? coreDrop.amount : 0,
          enhanceCores: coreDrop.enhanceCores,
        };
      },
    );
  });

  return NextResponse.json(result.result);
}
