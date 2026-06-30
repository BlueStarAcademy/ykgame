import Link from "next/link";
import type { GameConfig } from "@/lib/games";
import { isGameAvailable } from "@/lib/games";
import { GameCardSprite } from "@/components/home/GameCardSprite";

interface GameCardProps {
  game: GameConfig;
  progress?: { score: number; stars: number; playTime: number };
}

function Stars({ count }: { count: number }) {
  return (
    <span className="text-yellow-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
      {"★".repeat(count)}
      {"☆".repeat(3 - count)}
    </span>
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function StatPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="game-card-stat-pill rounded-md border border-white/30 bg-gradient-to-b from-white/30 to-white/10 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-md">
      {children}
    </span>
  );
}

interface CardInnerProps {
  game: GameConfig;
  progress?: { score: number; stars: number; playTime: number };
  locked: boolean;
}

function CardInner({ game, progress, locked }: CardInnerProps) {
  const stars = progress?.stars ?? 0;
  const score = progress?.score ?? 0;
  const playTime = progress?.playTime ?? 0;

  return (
    <>
      <div
        className="game-card-header relative flex items-center gap-2.5 px-3 py-2.5 text-white"
        style={{ backgroundColor: game.headerColor }}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 via-white/5 to-black/10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-black/20" />
        <span className="game-card-badge relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-white/40 to-white/15 text-sm font-bold">
          {game.number}
        </span>
        <div className="relative min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider opacity-90 drop-shadow-sm">
            {game.brandKo}
          </p>
          <p className="truncate text-sm font-bold tracking-wide drop-shadow-sm">
            {game.brandEn}
          </p>
        </div>
      </div>

      <div
        className={`game-card-preview relative flex h-32 items-end p-3 ${
          locked ? "grayscale brightness-75" : ""
        }`}
        style={{
          background: `linear-gradient(160deg, ${game.color} 0%, ${game.headerColor} 55%, ${game.headerColor} 100%)`,
        }}
      >
        {!locked && (
          <>
            <div className="absolute left-2 top-2 z-10">
              <StatPill>
                ⏱ {playTime > 0 ? formatTime(playTime) : "--:--"}
              </StatPill>
            </div>
            <div className="absolute right-2 top-2 z-10 text-sm">
              <Stars count={stars} />
            </div>
            <div className="absolute bottom-2 left-2 z-10">
              <StatPill>
                {game.controlType === "dpad"
                  ? "🎮 D-pad"
                  : game.controlType === "steering"
                    ? "🛞 조향"
                    : "🔘 버튼"}
              </StatPill>
            </div>
            <div className="absolute bottom-2 right-2 z-10">
              <StatPill>{score > 0 ? `${score}점` : "0%"}</StatPill>
            </div>
          </>
        )}

        {game.id === "yanmar" ? (
          <div className="game-card-hero-wrap">
            <GameCardSprite
              gameId={game.id}
              className={locked ? "game-card-sprite-locked" : ""}
            />
          </div>
        ) : (
          <div className="game-card-sprite-wrap absolute bottom-1 right-3 z-10">
            <GameCardSprite
              gameId={game.id}
              className={`scale-125 ${locked ? "game-card-sprite-locked" : ""}`}
            />
          </div>
        )}

        {locked && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 backdrop-blur-sm">
            <span className="game-card-soon-badge rounded-full border border-white/40 bg-gradient-to-b from-black/60 to-black/80 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-white">
              COMING SOON
            </span>
          </div>
        )}
      </div>

      <div
        className={`game-card-footer border-t px-3 py-2.5 ${
          locked ? "bg-gray-100/70" : "bg-gradient-to-b from-gray-50 to-gray-100/90"
        }`}
      >
        <p
          className={`text-xs leading-snug ${
            locked ? "text-gray-400" : "font-medium tracking-tight text-gray-600"
          }`}
        >
          🎯 {game.mission}
        </p>
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
