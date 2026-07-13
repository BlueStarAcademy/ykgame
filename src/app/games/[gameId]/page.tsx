import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isGameAvailable } from "@/lib/games";
import { isValidGameId } from "@/games/registry";
import { GamePlayClient } from "@/components/games/GamePlayClient";
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

  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  });
  if (account && !account.isActive) {
    redirect("/home");
  }

  const { gameId } = await params;
  const { play } = await searchParams;
  if (!isValidGameId(gameId)) notFound();

  const initialPlay = play === "ride" ? "ride" : undefined;
  const isRideEntry = gameId === "yanmar" && initialPlay === "ride";

  if (isRideEntry) {
    if (!isGameAvailable(gameId)) redirect("/ride");
    return <GamePlayClient gameId={gameId} initialPlay="ride" standalone />;
  }

  // 게임체험 로비는 /home(얀마 전용)으로 통일
  redirect("/home");
}
