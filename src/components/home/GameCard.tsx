import Link from "next/link";
import type { GameConfig } from "@/lib/games";
import { isGameAvailable } from "@/lib/games";
import { GameCardSprite } from "@/components/home/GameCardSprite";

interface GameCardProps {
  game: GameConfig;
  progress?: { score: number; stars: number; playTime: number };
}

interface CardInnerProps {
  game: GameConfig;
  progress?: { score: number; stars: number; playTime: number };
  locked: boolean;
}

function formatScore(score: number) {
  return score > 0 ? `${score.toLocaleString()}점` : "—";
}

function CardInner({ game, progress, locked }: CardInnerProps) {
  const score = progress?.score ?? 0;

  return (
    <>
      <div
        className="game-card-header relative flex items-center gap-2.5 px-3 py-2 text-white"
        style={{ backgroundColor: game.headerColor }}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 via-white/5 to-black/10" />
        <span className="game-card-badge relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-white/40 to-white/15 text-xs font-bold">
          {game.number}
        </span>
        <p className="relative truncate text-sm font-bold tracking-wide drop-shadow-sm">
          {game.brandKo}
        </p>
      </div>

      <div
        className={`game-card-preview relative flex h-28 flex-col items-center justify-center ${
          locked ? "grayscale brightness-75" : ""
        }`}
        style={{
          background: `linear-gradient(160deg, ${game.color} 0%, ${game.headerColor} 55%, ${game.headerColor} 100%)`,
        }}
      >
        <div className="game-card-sprite-wrap relative z-10">
          <GameCardSprite
            gameId={game.id}
            className={
              game.id === "yanmar"
                ? locked
                  ? "game-card-sprite-locked"
                  : ""
                : `scale-[1.75] ${locked ? "game-card-sprite-locked" : ""}`
            }
          />
        </div>

        {!locked ? (
          <p className="relative z-10 mt-2 text-xs font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
            {formatScore(score)}
          </p>
        ) : null}

        {locked ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 backdrop-blur-sm">
            <span className="rounded-full bg-black/70 px-3 py-1 text-[10px] font-bold text-white">
              준비 중
            </span>
          </div>
        ) : null}
      </div>
    </>
  );
}

export function GameCard({ game, progress }: GameCardProps) {
  const available = isGameAvailable(game.id);
  const inner = <CardInner game={game} progress={progress} locked={!available} />;

  if (available) {
    return (
      <Link href={`/games/${game.id}`} className="game-card-active">
        <div className="game-card-surface">{inner}</div>
      </Link>
    );
  }

  return (
    <div aria-disabled="true" className="game-card-locked pointer-events-none">
      <div className="game-card-surface">{inner}</div>
    </div>
  );
}
