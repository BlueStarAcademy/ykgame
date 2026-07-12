"use client";

import {
  formatXpProgress,
  getPlayerLevelProgress,
} from "@/lib/playerLevel";

interface HomeProfilePanelProps {
  nickname: string;
  totalXp: number;
  rank: number | null;
  seasonScore?: number;
  /** @deprecated Kept for call-site compatibility; not shown in the panel */
  highlightGameName?: string | null;
  /** @deprecated Kept for call-site compatibility; not shown in the panel */
  seasonLabel?: string;
}

function formatSeasonScore(score: number) {
  return score > 0 ? score.toLocaleString() : "—";
}

function formatRank(rank: number | null) {
  return rank ? `#${rank}` : "—";
}

export function HomeProfilePanel({
  nickname,
  totalXp,
  rank,
  seasonScore = 0,
}: HomeProfilePanelProps) {
  const progress = getPlayerLevelProgress(totalXp);
  const initial = nickname.trim().charAt(0) || "?";

  return (
    <section
      className="home-profile-panel relative overflow-hidden rounded-2xl border border-slate-200/70 bg-[#f7f6f4] shadow-[0_10px_28px_rgba(15,23,42,0.06)]"
      aria-label="플레이어 프로필"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,rgba(198,40,40,0.10),transparent_55%),linear-gradient(145deg,#fbfaf8_0%,#f3f1ed_48%,#eceae5_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(15,23,42,0.08),transparent_68%)]"
        aria-hidden
      />

      <div className="relative flex items-center gap-2.5 px-3 py-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 text-sm font-semibold tracking-wide text-[#f4efe6] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_16px_rgba(15,23,42,0.22)]">
          {initial}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="shrink-0 text-[11px] font-black tabular-nums leading-none text-[#b71c1c]">
              Lv.{progress.level}
            </span>
            <h2 className="truncate text-[15px] font-bold leading-none tracking-tight text-slate-900">
              {nickname}
            </h2>
          </div>
          <div className="relative mt-1.5 min-w-0 w-full overflow-hidden">
            <div className="home-profile-xp-track h-2.5 w-full overflow-hidden rounded-full bg-slate-900/10">
              <div
                className="home-profile-xp-fill h-full rounded-full bg-gradient-to-r from-[#b71c1c] via-[#c62828] to-[#e8a45a]"
                style={{
                  width: `${Math.max(0, Math.min(100, progress.progressPct))}%`,
                }}
              />
            </div>
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-end px-1.5 text-[8px] font-black leading-none tabular-nums text-white"
              style={{
                textShadow:
                  "0 0 2px rgba(0,0,0,0.95), 0 1px 1px rgba(0,0,0,0.85)",
              }}
              title={formatXpProgress(progress)}
            >
              <span className="truncate">
                {progress.currentXp.toLocaleString()}/
                {progress.requiredXp.toLocaleString()}
                <span className="text-amber-100">
                  ({progress.progressPct}%)
                </span>
              </span>
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-stretch gap-0 border-l border-slate-200/90 pl-2.5">
          <div className="px-1.5 text-center">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-500">
              점수
            </p>
            <p className="mt-0.5 text-[12px] font-bold tabular-nums leading-none text-slate-900">
              {formatSeasonScore(seasonScore)}
              {seasonScore > 0 ? (
                <span className="ml-0.5 text-[8px] font-semibold text-slate-400">점</span>
              ) : null}
            </p>
          </div>
          <div className="border-l border-slate-200/90 px-1.5 text-center">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-500">
              랭킹
            </p>
            <p className="mt-0.5 text-[12px] font-bold tabular-nums leading-none text-slate-900">
              {formatRank(rank)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
