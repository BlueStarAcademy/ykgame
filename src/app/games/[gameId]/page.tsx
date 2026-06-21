import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getGameById } from "@/lib/games";
import { isValidGameId } from "@/games/registry";
import { GamePlayClient } from "@/components/games/GamePlayClient";

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

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-100 to-white p-4">
      <div className="mx-auto max-w-lg">
        <GamePlayClient gameId={gameId} />
      </div>
    </main>
  );
}
