import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getGameById, isGameAvailable } from "@/lib/games";
import { isValidGameId } from "@/games/registry";
import { GamePlayClient } from "@/components/games/GamePlayClient";
import { AppShell } from "@/components/layout/AppShell";
import { prisma } from "@/lib/prisma";

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ play?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.nickname) redirect("/nickname");

  const { gameId } = await params;
  const { play } = await searchParams;
  if (!isValidGameId(gameId)) notFound();
  // 로비(게임방법/보상/랭킹)는 모든 브랜드 진입 가능. 플레이 잠금은 클라이언트에서 처리.
  getGameById(gameId);

  const initialPlay = play === "ride" ? "ride" : undefined;
  const isRideEntry = gameId === "yanmar" && initialPlay === "ride";

  if (isRideEntry) {
    if (!isGameAvailable(gameId)) redirect("/ride");
    return <GamePlayClient gameId={gameId} initialPlay="ride" standalone />;
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
    >
      <GamePlayClient gameId={gameId} />
    </AppShell>
  );
}
