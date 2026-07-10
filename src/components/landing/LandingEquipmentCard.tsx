import type { GameConfig } from "@/lib/games";
import { isGameAvailable } from "@/lib/games";
import { BRAND_PROFILES } from "@/lib/landing-content";
import { GameCardSprite } from "@/components/home/GameCardSprite";

interface LandingEquipmentCardProps {
  game: GameConfig;
}

export function LandingEquipmentCard({ game }: LandingEquipmentCardProps) {
  const available = isGameAvailable(game.id);
  const profile = BRAND_PROFILES[game.id];

  return (
    <article className="landing-equipment-card group overflow-hidden">
      <div className="landing-equipment-visual relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            background: `radial-gradient(ellipse 90% 70% at 70% 30%, ${game.color} 0%, transparent 62%)`,
          }}
          aria-hidden
        />
        <div className="landing-equipment-art">
          <GameCardSprite gameId={game.id} />
        </div>

        <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black text-white shadow-sm"
            style={{ backgroundColor: game.headerColor }}
          >
            {game.number}
          </span>
          <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-slate-500 shadow-sm backdrop-blur-sm">
            {profile.category}
          </span>
        </div>

        <div className="absolute right-2.5 top-2.5 z-10">
          {available ? (
            <span className="rounded-full bg-emerald-500/95 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white shadow-sm">
              Open
            </span>
          ) : (
            <span className="rounded-full bg-slate-900/55 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white/95 backdrop-blur-sm">
              Soon
            </span>
          )}
        </div>
      </div>

      <div className={`landing-equipment-copy px-3 pb-3 pt-2 ${available ? "" : "opacity-80"}`}>
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
          {game.brandEn}
        </p>
        <h3 className="mt-0.5 truncate text-[13px] font-bold tracking-tight text-slate-900">
          {game.brandKo}
        </h3>
        <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-slate-500">
          {profile.highlight}
        </p>
      </div>
    </article>
  );
}
