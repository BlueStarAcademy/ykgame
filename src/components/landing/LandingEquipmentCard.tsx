import type { GameConfig } from "@/lib/games";
import { isGameAvailable } from "@/lib/games";
import { BRAND_PROFILES } from "@/lib/landing-content";

interface LandingEquipmentCardProps {
  game: GameConfig;
}

export function landingEquipmentImage(id: string) {
  return `/images/landing/equipment/${id}.jpg`;
}

export function LandingEquipmentCard({ game }: LandingEquipmentCardProps) {
  const available = isGameAvailable(game.id);
  const profile = BRAND_PROFILES[game.id];

  return (
    <article className="landing-equipment-card group overflow-hidden">
      <div className="relative aspect-[2.35/1] overflow-hidden bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={landingEquipmentImage(game.id)}
          alt={`${game.brandEn} ${profile.category}`}
          className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-3">
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              {profile.category}
            </p>
            <h3 className="mt-0.5 text-base font-semibold tracking-tight text-white">
              {game.brandEn}
              <span className="ml-1.5 text-sm font-normal text-white/75">{game.brandKo}</span>
            </h3>
          </div>
          {available ? (
            <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 shadow-sm">
              Open
            </span>
          ) : (
            <span className="rounded-full bg-black/40 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/90 backdrop-blur-sm">
              Soon
            </span>
          )}
        </div>
      </div>

      <div className={`px-4 py-3.5 ${available ? "" : "opacity-85"}`}>
        <p className="text-xs font-medium text-gray-800">{game.mission}</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">{profile.highlight}</p>
      </div>
    </article>
  );
}
