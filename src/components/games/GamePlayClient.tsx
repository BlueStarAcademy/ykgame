"use client";

import Link from "next/link";
import { PhaserGameWrapper } from "@/components/games/PhaserGameWrapper";
import type { GameId } from "@/lib/games";
import { getGameById } from "@/lib/games";

interface GamePlayClientProps {
  gameId: GameId;
}

export function GamePlayClient({ gameId }: GamePlayClientProps) {
  const game = getGameById(gameId);

  return (
    <>
      <Link
        href="/home"
        className="mb-3 inline-block text-sm text-blue-600 hover:underline"
      >
        ← 홈으로
      </Link>
      <PhaserGameWrapper gameId={gameId} />
      <p className="mt-3 text-center text-xs text-gray-400">
        {game?.brandKo} · {game?.mission}
      </p>
    </>
  );
}
