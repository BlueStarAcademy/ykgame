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

  return (
    <AppShell
      nickname={user?.nickname ?? session.user.nickname ?? ""}
      currency={user?.currency ?? 0}
      role={session.user.role}
      showHomeFeatures
    >
      <div className="mb-4 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
          YK
        </div>
        <h1 className="text-lg font-bold text-gray-900">YK건기 브랜드 캐주얼 게임</h1>
        <p className="mx-auto mt-2 inline-block rounded-full bg-blue-100 px-4 py-1 text-xs text-blue-700">
          ✨ 장비를 쉽고 재미있게 체험하는 미니게임 ✨
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {GAMES.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            progress={bestByGame.get(game.id)}
          />
        ))}
      </div>
    </AppShell>
  );
}
