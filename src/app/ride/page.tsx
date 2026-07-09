import { GameCard } from "@/components/home/GameCard";
import { AppShell } from "@/components/layout/AppShell";
import { GAMES } from "@/lib/games";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function RideHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.nickname) redirect("/nickname");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currency: true, nickname: true },
  });

  const nickname = user?.nickname ?? session.user.nickname ?? "";
  const currency = user?.currency ?? 0;

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
          체험존으로 돌아가기
        </Link>

        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-500">
            Ride Experience
          </p>
          <h1 className="mt-1 text-base font-black text-slate-900">탑승 체험</h1>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            장비를 선택해 운전실에서 실제 조작감을 체험해보세요.
          </p>
        </div>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <h2 className="mb-2 shrink-0 px-0.5 text-sm font-black text-slate-800">장비 선택</h2>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="grid grid-cols-2 gap-4 pb-2">
            {GAMES.map((game) => (
              <GameCard key={game.id} game={game} playMode="ride" />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
