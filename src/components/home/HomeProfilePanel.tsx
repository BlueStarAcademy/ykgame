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
  /** Brand shown for the season highlight (best ranking game) */
  highlightGameName?: string | null;
  seasonLabel: string;
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
  highlightGameName = null,
  seasonLabel,
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

      <div className="relative flex items-center gap-3 px-3.5 py-3">
        <div className="relative shrink-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 text-sm font-semibold tracking-wide text-[#f4efe6] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_16px_rgba(15,23,42,0.22)]">
            {initial}
          </div>
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/70 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.04em] text-amber-100 shadow-sm">
            Lv.{progress.level}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-bold leading-none tracking-tight text-slate-900">
            {nickname}
          </h2>
          <div className="mt-1.5 flex min-w-0 items-center gap-2">
            <div className="home-profile-xp-track h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-900/10">
              <div
                className="home-profile-xp-fill h-full rounded-full bg-gradient-to-r from-[#b71c1c] via-[#c62828] to-[#e8a45a]"
                style={{
                  width: `${Math.max(0, Math.min(100, progress.progressPct))}%`,
                }}
                aria-label={formatXpProgress(progress)}
              />
            </div>
            <p className="shrink-0 text-[10px] font-bold tabular-nums leading-none text-slate-600">
              {progress.currentXp.toLocaleString()}/
              {progress.requiredXp.toLocaleString()}
              <span className="text-slate-400">({progress.progressPct}%)</span>
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex items-center justify-center gap-2.5 border-t border-slate-200/70 px-3 py-2.5 sm:gap-3">
        <div className="text-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
            시즌
          </p>
          <p className="mt-0.5 whitespace-nowrap text-[11px] font-bold leading-none text-slate-900">
            {seasonLabel}
          </p>
        </div>
        <span className="h-6 w-px bg-slate-200/90" aria-hidden />
        {highlightGameName ? (
          <>
            <div className="text-center">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                게임
              </p>
              <p className="mt-0.5 max-w-[4rem] truncate text-[12px] font-bold leading-none text-slate-900">
                {highlightGameName}
              </p>
            </div>
            <span className="h-6 w-px bg-slate-200/90" aria-hidden />
          </>
        ) : null}
        <div className="text-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
            점수
          </p>
          <p className="mt-0.5 text-[12px] font-bold tabular-nums leading-none text-slate-900">
            {formatSeasonScore(seasonScore)}
            {seasonScore > 0 ? (
              <span className="ml-0.5 text-[9px] font-semibold text-slate-400">점</span>
            ) : null}
          </p>
        </div>
        <span className="h-6 w-px bg-slate-200/90" aria-hidden />
        <div className="text-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
            랭킹
          </p>
          <p className="mt-0.5 text-[12px] font-bold tabular-nums leading-none text-slate-900">
            {formatRank(rank)}
          </p>
        </div>
      </div>
    </section>
  );
}
