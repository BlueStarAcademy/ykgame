import { ProfileBox } from "@/components/home/ProfileBox";
import { GameCard } from "@/components/home/GameCard";
import { GAMES } from "@/lib/games";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const FEATURES = [
  { icon: "🏆", title: "간단한 조작", desc: "누구나 쉽게 플레이!" },
  { icon: "🎮", title: "짧고 재미있는 미션", desc: "1~2분이면 한 판 완료!" },
  { icon: "💎", title: "보상 & 수집 요소", desc: "별을 모아 장비 업그레이드!" },
  { icon: "📊", title: "기록 & 랭킹", desc: "최고 점수에 도전하세요!" },
];

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

  const totalStars = Array.from(bestByGame.values()).reduce(
    (sum, g) => sum + g.stars,
    0,
  );

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-gradient-to-b from-sky-50 to-white pb-8">
      <header className="relative overflow-hidden bg-white px-4 pb-4 pt-6 shadow-sm">
        <div className="absolute left-4 top-4 text-2xl">🕹️⛑️</div>
        <div className="absolute right-4 top-2 text-4xl">👷</div>
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
            YK
          </div>
          <h1 className="text-lg font-bold text-gray-900">YK건기 브랜드 캐주얼 게임</h1>
          <p className="mx-auto mt-2 inline-block rounded-full bg-blue-100 px-4 py-1 text-xs text-blue-700">
            ✨ 장비를 쉽고 재미있게 체험하는 미니게임 ✨
          </p>
        </div>
      </header>

      <div className="space-y-4 px-4 pt-4">
        <ProfileBox
          nickname={user?.nickname ?? session.user.nickname ?? ""}
          currency={user?.currency ?? 0}
          totalStars={totalStars}
        />

        <div className="grid grid-cols-2 gap-3">
          {GAMES.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              progress={bestByGame.get(game.id)}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl bg-white p-3 text-center shadow-sm"
            >
              <div className="text-2xl">{f.icon}</div>
              <p className="mt-1 text-xs font-bold text-gray-800">{f.title}</p>
              <p className="text-[10px] text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
