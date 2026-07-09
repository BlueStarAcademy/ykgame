import Link from "next/link";
import type { GameConfig } from "@/lib/games";
import { isGameAvailable } from "@/lib/games";
import { GameCardSprite } from "@/components/home/GameCardSprite";

interface GameCardProps {
  game: GameConfig;
  progress?: { score: number; stars: number; playTime: number };
  rank?: number | null;
  playMode?: "ride";
}

interface CardInnerProps {
  game: GameConfig;
  progress?: { score: number; stars: number; playTime: number };
  rank?: number | null;
  locked: boolean;
  playMode?: "ride";
}

function formatScore(score: number) {
  return score > 0 ? `${score.toLocaleString()}점` : "—";
}

function formatRank(rank?: number | null) {
  return rank ? `#${rank}` : "—";
}

function CardInner({ game, progress, rank, locked, playMode }: CardInnerProps) {
  const score = progress?.score ?? 0;
  const isRide = playMode === "ride";

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
          <div className="relative z-10 mt-2 flex w-full flex-col items-center gap-1 px-2">
            {isRide ? (
              <span className="game-card-stat-pill rounded-full bg-black/25 px-2.5 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
                탑승 체험
              </span>
            ) : (
              <>
                <span className="game-card-stat-pill max-w-full truncate rounded-full bg-black/25 px-2.5 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
                  {formatScore(score)}
                </span>
                <span className="game-card-stat-pill rounded-full bg-black/25 px-2.5 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
                  랭킹 {formatRank(rank)}
                </span>
              </>
            )}
          </div>
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

export function GameCard({ game, progress, rank, playMode }: GameCardProps) {
  const available = isGameAvailable(game.id);
  const inner = (
    <CardInner
      game={game}
      progress={progress}
      rank={rank}
      locked={!available}
      playMode={playMode}
    />
  );

  if (available) {
    const href =
      playMode === "ride" ? `/games/${game.id}?play=ride` : `/games/${game.id}`;
    return (
      <Link href={href} className="game-card-active">
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
