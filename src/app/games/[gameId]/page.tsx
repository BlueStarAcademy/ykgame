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
  if (!isGameAvailable(gameId)) redirect("/home");

  getGameById(gameId);

  const initialPlay = play === "ride" ? "ride" : undefined;
  const isRideEntry = gameId === "yanmar" && initialPlay === "ride";

  if (isRideEntry) {
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
