import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getGameById } from "@/lib/games";
import { isValidGameId } from "@/games/registry";
import { GamePlayClient } from "@/components/games/GamePlayClient";
import { AppShell } from "@/components/layout/AppShell";
import { prisma } from "@/lib/prisma";

export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.nickname) redirect("/nickname");

  const { gameId } = await params;
  if (!isValidGameId(gameId)) notFound();

  getGameById(gameId);

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
