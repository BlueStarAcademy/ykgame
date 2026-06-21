import Link from "next/link";
import type { GameConfig } from "@/lib/games";

interface GameCardProps {
  game: GameConfig;
  progress?: { score: number; stars: number; playTime: number };
}

function Stars({ count }: { count: number }) {
  return (
    <span className="text-yellow-300">
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

export function GameCard({ game, progress }: GameCardProps) {
  const stars = progress?.stars ?? 0;
  const score = progress?.score ?? 0;
  const playTime = progress?.playTime ?? 0;

  return (
    <Link
      href={`/games/${game.id}`}
      className="block overflow-hidden rounded-2xl bg-white shadow-md transition hover:shadow-lg active:scale-[0.98]"
    >
      <div
        className="flex items-center gap-2 px-3 py-2 text-white"
        style={{ backgroundColor: game.headerColor }}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25 text-sm font-bold">
          {game.number}
        </span>
        <div>
          <p className="text-xs opacity-90">{game.brandKo}</p>
          <p className="text-sm font-bold tracking-wide">{game.brandEn}</p>
        </div>
      </div>

      <div
        className="relative flex h-28 items-end p-3"
        style={{
          background: `linear-gradient(135deg, ${game.color} 0%, ${game.headerColor} 100%)`,
        }}
      >
        <div className="absolute left-2 top-2 rounded bg-black/30 px-2 py-0.5 text-xs text-white">
          ⏱ {playTime > 0 ? formatTime(playTime) : "--:--"}
        </div>
        <div className="absolute right-2 top-2 text-sm">
          <Stars count={stars} />
        </div>
        <div className="absolute bottom-2 left-2 rounded bg-black/30 px-2 py-0.5 text-xs text-white">
          {game.controlType === "dpad" ? "🎮 D-pad" : game.controlType === "steering" ? "🛞 조향" : "🔘 버튼"}
        </div>
        <div className="absolute bottom-2 right-2 rounded bg-black/30 px-2 py-0.5 text-xs text-white">
          {score > 0 ? `${score}점` : "0%"}
        </div>
        <div className="text-4xl opacity-80">
          {game.number === 1 && "🚜"}
          {game.number === 2 && "🌾"}
          {game.number === 3 && "🏗️"}
          {game.number === 4 && "🛣️"}
          {game.number === 5 && "🚧"}
          {game.number === 6 && "🐄"}
          {game.number === 7 && "🔨"}
          {game.number === 8 && "⛰️"}
        </div>
      </div>

      <div className="border-t border-gray-100 px-3 py-2">
        <p className="text-xs text-gray-600">🎯 {game.mission}</p>
      </div>
    </Link>
  );
}
