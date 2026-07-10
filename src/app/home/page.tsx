import { GameCard } from "@/components/home/GameCard";
import { HomeProfilePanel } from "@/components/home/HomeProfilePanel";
import { AppShell } from "@/components/layout/AppShell";
import { GAMES, getSeasonInfo } from "@/lib/games";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserGameStats } from "@/lib/rankings";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.nickname) redirect("/nickname");

  const scores = await prisma.gameScore.findMany({
    where: { userId: session.user.id },
    orderBy: { score: "desc" },
  });

  const bestByGame = new Map<string, { score: number; stars: number; playTime: number }>();
  for (const s of scores) {
    const existing = bestByGame.get(s.gameId);
    if (!existing || s.score > existing.score) {
      bestByGame.set(s.gameId, {
        score: s.score,
        stars: s.stars,
        playTime: s.playTime,
      });
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currency: true, nickname: true, totalXp: true },
  });

  const nickname = user?.nickname ?? session.user.nickname ?? "";
  const currency = user?.currency ?? 0;
  const totalXp = user?.totalXp ?? 0;
  const season = getSeasonInfo();

  const gameStatsList = await Promise.all(
    GAMES.map(async (game) => {
      const stats = await getUserGameStats(game.id, session.user.id);
      return { gameId: game.id, ...stats };
    }),
  );
  const rankByGame = new Map(gameStatsList.map((stats) => [stats.gameId, stats.rank]));

  const rankedGames = gameStatsList
    .map((stats) => {
      const game = GAMES.find((item) => item.id === stats.gameId);
      return game ? { ...stats, brandKo: game.brandKo } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item != null && item.rank != null)
    .sort((a, b) => {
      const rankDiff = (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY);
      if (rankDiff !== 0) return rankDiff;
      return b.bestScore - a.bestScore;
    });

  const highlightStats = rankedGames[0] ?? null;

  return (
    <AppShell
      nickname={nickname}
      currency={currency}
      role={session.user.role}
      showHomeFeatures
    >
      <div className="shrink-0 space-y-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 transition hover:text-red-600"
        >
          <span aria-hidden>←</span>
          이전 페이지로 돌아가기
        </Link>

        <HomeProfilePanel
          nickname={nickname}
          totalXp={totalXp}
          rank={highlightStats?.rank ?? null}
          seasonScore={highlightStats?.bestScore ?? 0}
          highlightGameName={highlightStats?.brandKo ?? null}
          seasonLabel={season.label}
        />
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <h2 className="mb-2.5 shrink-0 px-0.5 text-[13px] font-bold tracking-tight text-slate-700">
          장비 선택
        </h2>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="grid grid-cols-2 gap-3.5 pb-2">
            {GAMES.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                progress={bestByGame.get(game.id)}
                rank={rankByGame.get(game.id) ?? null}
              />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
