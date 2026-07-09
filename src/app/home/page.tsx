import { GameCard } from "@/components/home/GameCard";
import { AppShell } from "@/components/layout/AppShell";
import { GAMES } from "@/lib/games";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
    select: { currency: true, nickname: true },
  });

  const playedCount = bestByGame.size;

  return (
    <AppShell
      nickname={user?.nickname ?? session.user.nickname ?? ""}
      currency={user?.currency ?? 0}
      role={session.user.role}
      showHomeFeatures
    >
      <section className="home-hero relative shrink-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_32px_-8px_rgba(15,23,42,0.12)]">
        <div className="home-hero-grid pointer-events-none absolute inset-0" />
        <div className="home-hero-glow pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-red-500/10 blur-2xl" />
        <div className="home-hero-glow pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl" />

        <div className="relative px-5 pb-5 pt-6 text-center">
          <div className="flex items-center justify-center gap-2.5">
            <div className="home-hero-logo flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black tracking-tight text-white shadow-lg">
              YK
            </div>
            <h1 className="text-lg font-black tracking-tight text-slate-900">
              YK건기 게임 체험
            </h1>
          </div>
          <p className="mx-auto mt-3 max-w-[18rem] text-xs leading-relaxed text-slate-500">
            미션·스타·쿠폰 보상과 랭킹에 도전하는
            <br />
            브랜드 캐주얼 게임 허브입니다
          </p>

          <div className="mx-auto mt-4 grid max-w-[14rem] grid-cols-2 gap-2">
            <div className="home-hero-stat rounded-xl px-2 py-2.5">
              <p className="text-[9px] font-semibold text-slate-400">브랜드</p>
              <p className="mt-0.5 text-sm font-black text-slate-800">8종</p>
            </div>
            <div className="home-hero-stat rounded-xl px-2 py-2.5">
              <p className="text-[9px] font-semibold text-slate-400">플레이</p>
              <p className="mt-0.5 text-sm font-black text-slate-800">{playedCount}게임</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex shrink-0 items-end justify-between px-0.5">
          <h2 className="text-sm font-black text-slate-800">장비 선택</h2>
          <p className="text-[10px] text-slate-400">카드를 눌러 입장</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="grid grid-cols-2 gap-4 pb-2">
            {GAMES.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                progress={bestByGame.get(game.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
