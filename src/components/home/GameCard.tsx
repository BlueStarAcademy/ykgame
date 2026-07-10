"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GameConfig } from "@/lib/games";
import { prepareInGameFullscreen } from "@/lib/fullscreen";
import { enablePwaMode } from "@/lib/pwa-mode";
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
  playMode?: "ride";
}

function formatScore(score: number) {
  return score > 0 ? score.toLocaleString() : "—";
}

function formatRank(rank?: number | null) {
  return rank ? `#${rank}` : "—";
}

function CardInner({ game, progress, rank, playMode }: CardInnerProps) {
  const score = progress?.score ?? 0;
  const isRide = playMode === "ride";

  return (
    <>
      <div className="game-card-preview relative flex h-[8.5rem] flex-col overflow-hidden">
        <div className="game-card-sprite-wrap absolute inset-0">
          <GameCardSprite gameId={game.id} />
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-14 bg-gradient-to-b from-white/95 via-white/65 to-transparent"
          aria-hidden
        />

        <div className="relative z-10 flex items-start justify-between gap-2 px-2.5 pt-2">
          <div className="min-w-0">
            <p className="truncate text-[8px] font-bold uppercase tracking-[0.16em] text-slate-500">
              {game.brandEn}
            </p>
            <p className="mt-0.5 truncate text-[13px] font-bold leading-tight tracking-tight text-slate-900">
              {game.brandKo}
            </p>
          </div>
          <span
            className="game-card-badge flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
            style={{ backgroundColor: game.headerColor }}
          >
            {game.number}
          </span>
        </div>
      </div>

      <div className="game-card-footer relative z-10 px-2.5 py-2">
        {isRide ? (
          <p className="text-center text-[11px] font-bold tracking-wide text-slate-600">
            탑승 체험
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center">
              <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
                시즌 점수
              </p>
              <p className="mt-0.5 text-[12px] font-bold tabular-nums leading-none text-slate-800">
                {formatScore(score)}
                {score > 0 ? (
                  <span className="ml-0.5 text-[9px] font-semibold text-slate-400">점</span>
                ) : null}
              </p>
            </div>
            <div className="border-l border-slate-200/90 text-center">
              <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
                랭킹
              </p>
              <p className="mt-0.5 text-[12px] font-bold tabular-nums leading-none text-slate-800">
                {formatRank(rank)}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function GameCard({ game, progress, rank, playMode }: GameCardProps) {
  const router = useRouter();
  const href =
    playMode === "ride" ? `/games/${game.id}?play=ride` : `/games/${game.id}`;
  const inner = (
    <CardInner game={game} progress={progress} rank={rank} playMode={playMode} />
  );

  if (playMode === "ride") {
    return (
      <a
        href={href}
        className="game-card-active"
        onClick={(e) => {
          e.preventDefault();
          void (async () => {
            enablePwaMode();
            await prepareInGameFullscreen();
            router.push(href);
          })();
        }}
      >
        <div className="game-card-surface">{inner}</div>
      </a>
    );
  }

  return (
    <Link href={href} className="game-card-active">
      <div className="game-card-surface">{inner}</div>
    </Link>
  );
}
