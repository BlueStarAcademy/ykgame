"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  SPORTS_MEET_WEEKLY_REWARD_TIERS,
  type SportsMeetPlayMode,
} from "./sportsMeet";

const STAR_CURRENCY_ICON = "/images/star-currency.svg";

type TicketPayload = {
  dayKey: string;
  weekKey: string;
  patternId: number;
  patternName: string;
  stageOrderLabel: string;
  rewardTiers: string[];
  ticket: {
    limit: number;
    used: number;
    remaining: number;
    resetInMs: number;
  };
};

type RankingsPayload = {
  weekKey: string;
  isPrevious: boolean;
  patternName: string;
  stageOrderLabel: string;
  rewardTiers: string[];
  rankings: Array<{
    rank: number;
    nickname: string;
    bestTimeMs: number;
  }>;
  myStats: {
    rank: number | null;
    bestTimeMs: number | null;
    rewardStars: number | null;
  } | null;
};

function formatTimeMs(ms: number) {
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = totalSec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

export function SportsMeetModePanel({
  open,
  onClose,
  onEnter,
  onOpenRankings,
}: {
  open: boolean;
  onClose: () => void;
  onEnter: (mode: SportsMeetPlayMode) => void;
  onOpenRankings: (week: "current" | "previous") => void;
}) {
  const t = useTranslations("yanmar.sportsMeet");
  const [data, setData] = useState<TicketPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch("/api/sports-meet/yanmar/ticket")
      .then(async (res) => {
        if (!res.ok) throw new Error(t("ticketLoadFailed"));
        return (await res.json()) as TicketPayload;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("error"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const remaining = data?.ticket.remaining ?? 0;
  const limit = data?.ticket.limit ?? 1;
  const rankedDisabled = !data || remaining < 1;

  return (
    <div className="yanmar-unlock-overlay" role="presentation">
      <div
        className="yanmar-unlock-panel yanmar-sports-meet-entry"
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
      >
        <button
          type="button"
          className="yanmar-sports-meet-entry-close"
          onClick={onClose}
          aria-label={t("close")}
        >
          ×
        </button>
        <div className="yanmar-unlock-body yanmar-sports-meet-entry-body">
          <h2 className="yanmar-unlock-title yanmar-sports-meet-entry-title">
            {t("title")}
          </h2>

          {loading ? (
            <p className="yanmar-unlock-lead">{t("loading")}</p>
          ) : error ? (
            <p className="yanmar-unlock-lead">{error}</p>
          ) : (
            <div className="yanmar-sports-meet-entry-grid">
              <section className="yanmar-sports-meet-entry-card yanmar-sports-meet-entry-course">
                <h3 className="yanmar-sports-meet-entry-card-title">
                  {t("thisWeekCourse")}
                </h3>
                <p className="yanmar-sports-meet-entry-card-name">
                  {data?.patternName ?? "—"}
                </p>
                <p className="yanmar-sports-meet-entry-card-text">
                  {data?.stageOrderLabel ?? ""}
                </p>
              </section>

              <section className="yanmar-sports-meet-entry-card yanmar-sports-meet-entry-rewards-panel">
                <h3 className="yanmar-sports-meet-entry-card-title">
                  {t("rankRewards")}
                </h3>
                <ul className="yanmar-sports-meet-entry-reward-rows">
                  {SPORTS_MEET_WEEKLY_REWARD_TIERS.map((tier) => {
                    const podium =
                      tier.minRank === tier.maxRank && tier.minRank <= 3
                        ? tier.minRank
                        : 0;
                    return (
                      <li
                        key={`${tier.minRank}-${tier.maxRank}`}
                        className={`yanmar-sports-meet-entry-reward-row${
                          podium
                            ? ` is-podium is-podium-${podium}`
                            : " is-rest"
                        }`}
                      >
                        <span
                          className={`yanmar-sports-meet-entry-reward-rank${
                            podium ? ` is-podium-${podium}` : ""
                          }`}
                        >
                          {podium ? (
                            <span
                              className="yanmar-sports-meet-entry-medal"
                              aria-hidden
                            >
                              {podium}
                            </span>
                          ) : null}
                          <span>
                            {tier.minRank === tier.maxRank
                              ? t("rank", { rank: tier.minRank })
                              : tier.maxRank === Number.POSITIVE_INFINITY
                                ? t("rankOrLower", { rank: tier.minRank })
                                : t("rankRange", {
                                    min: tier.minRank,
                                    max: tier.maxRank,
                                  })}
                          </span>
                        </span>
                        <span className="yanmar-sports-meet-entry-reward-stars">
                          <img
                            src={STAR_CURRENCY_ICON}
                            alt=""
                            width={16}
                            height={16}
                            draggable={false}
                          />
                          <span>{tier.stars.toLocaleString()}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="yanmar-sports-meet-entry-reward-note">
                  {t("weeklyResetNote")}
                </p>
              </section>
            </div>
          )}

          <div className="yanmar-sports-meet-entry-rankings">
            <button
              type="button"
              className="yanmar-sports-meet-entry-rank-btn"
              onClick={() => onOpenRankings("current")}
            >
              {t("thisWeekRankings")}
            </button>
            <button
              type="button"
              className="yanmar-sports-meet-entry-rank-btn"
              onClick={() => onOpenRankings("previous")}
            >
              {t("previousWeekRankings")}
            </button>
          </div>

          <div className="yanmar-sports-meet-entry-actions">
            <button
              type="button"
              className="yanmar-sports-meet-entry-enter"
              disabled={rankedDisabled}
              onClick={() => onEnter("ranked")}
            >
              <span className="yanmar-sports-meet-entry-enter-label">
                {t("rankedMode")}
              </span>
              <span className="yanmar-sports-meet-entry-enter-ticket">
                <img
                  src="/images/yanmar/2d/sports-meet-ticket.svg"
                  alt=""
                  width={18}
                  height={18}
                  draggable={false}
                />
                <span>
                  ({remaining}/{limit})
                </span>
              </span>
            </button>
            <button
              type="button"
              className="yanmar-sports-meet-entry-practice"
              onClick={() => onEnter("practice")}
            >
              {t("practiceMode")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SportsMeetRankingsPanel({
  open,
  week,
  onClose,
  onSwitchWeek,
}: {
  open: boolean;
  week: "current" | "previous";
  onClose: () => void;
  onSwitchWeek: (week: "current" | "previous") => void;
}) {
  const t = useTranslations("yanmar.sportsMeet");
  const [data, setData] = useState<RankingsPayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void fetch(`/api/sports-meet/yanmar/rankings?week=${week}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("fail");
        return (await res.json()) as RankingsPayload;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, week]);

  if (!open) return null;

  return (
    <div className="yanmar-unlock-overlay" role="presentation">
      <div
        className="yanmar-unlock-panel yanmar-sports-meet-rankings"
        role="dialog"
        aria-modal="true"
        aria-label={t("rankingsAriaLabel")}
        style={{
          width: "min(28rem, 94vw)",
          maxWidth: "28rem",
          height: "min(34rem, 86vh)",
          minHeight: "min(34rem, 86vh)",
          maxHeight: "min(34rem, 86vh)",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
      >
        <div className="yanmar-unlock-body yanmar-sports-meet-rankings-body">
          <h2 className="yanmar-unlock-title yanmar-sports-meet-rankings-title">
            {week === "previous" ? t("previousWeekRankings") : t("thisWeekRankings")}
          </h2>

          <div className="yanmar-sports-meet-rankings-meta">
            {loading ? (
              <p className="yanmar-unlock-lead">{t("loading")}</p>
            ) : data ? (
              <>
                <p className="yanmar-unlock-lead">
                  {data.weekKey} · {data.patternName}
                  <br />
                  {data.stageOrderLabel}
                </p>
                {data.myStats?.rank != null ? (
                  <p className="yanmar-sports-meet-rankings-mine">
                    {t("myRank", { rank: data.myStats.rank })} ·{" "}
                    {data.myStats.bestTimeMs != null
                      ? formatTimeMs(data.myStats.bestTimeMs)
                      : "-"}
                    {data.myStats.rewardStars != null
                      ? ` · ${t("reward", { stars: data.myStats.rewardStars.toLocaleString() })}`
                      : ""}
                  </p>
                ) : (
                  <p className="yanmar-sports-meet-rankings-empty">
                    {week === "previous"
                      ? t("noPreviousWeekRecords")
                      : t("noThisWeekRecords")}
                  </p>
                )}
              </>
            ) : (
              <p className="yanmar-unlock-lead">{t("rankingsLoadFailed")}</p>
            )}
          </div>

          <div className="yanmar-sports-meet-rankings-table-wrap">
            {loading ? (
              <p className="yanmar-sports-meet-rankings-placeholder">
                {t("loading")}
              </p>
            ) : !data ? (
              <p className="yanmar-sports-meet-rankings-placeholder">
                {t("rankingsLoadFailed")}
              </p>
            ) : data.rankings.length === 0 ? (
              <p className="yanmar-sports-meet-rankings-placeholder">
                {t("noRecords")}
              </p>
            ) : (
              <table className="yanmar-sports-meet-rankings-table">
                <thead>
                  <tr>
                    <th>{t("rankHeader")}</th>
                    <th>{t("nicknameHeader")}</th>
                    <th>{t("timeHeader")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rankings.map((row) => (
                    <tr key={row.rank}>
                      <td className="is-rank">{row.rank}</td>
                      <td>{row.nickname}</td>
                      <td className="is-time">
                        {formatTimeMs(row.bestTimeMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="yanmar-sports-meet-rankings-actions">
            <button
              type="button"
              className="yanmar-sports-meet-rankings-action-btn yanmar-sports-meet-rankings-action-btn--switch"
              onClick={() =>
                onSwitchWeek(week === "current" ? "previous" : "current")
              }
            >
              {week === "current" ? t("previousWeekRankings") : t("thisWeekRankings")}
            </button>
            <button
              type="button"
              className="yanmar-sports-meet-rankings-action-btn yanmar-sports-meet-rankings-action-btn--close"
              onClick={onClose}
            >
              {t("close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SportsMeetHud({
  stageLabel,
  progressLabel,
  elapsedMs,
  raceStartedAtMs = 0,
  countdownEndsAtMs = 0,
  phase,
  patternName,
  stageIndex,
  stageTotal,
  onStart,
  onExit,
}: {
  stageLabel: string;
  progressLabel: string;
  /** Finished time, or initial elapsed; live racing time ticks inside this HUD. */
  elapsedMs: number;
  raceStartedAtMs?: number;
  countdownEndsAtMs?: number;
  phase: string;
  patternName: string;
  stageIndex: number;
  stageTotal: number;
  onStart: () => void;
  onExit: () => void;
}) {
  const t = useTranslations("yanmar.sportsMeet");
  const [liveElapsedMs, setLiveElapsedMs] = useState(elapsedMs);
  const [countdownSec, setCountdownSec] = useState<number | null>(null);

  useEffect(() => {
    if (phase === "finished") {
      setLiveElapsedMs(elapsedMs);
      return;
    }
    if (phase !== "racing" || raceStartedAtMs <= 0) {
      setLiveElapsedMs(0);
      return;
    }
    const tick = () => {
      setLiveElapsedMs(Math.max(0, Date.now() - raceStartedAtMs));
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [phase, raceStartedAtMs, elapsedMs]);

  useEffect(() => {
    if (phase !== "countdown" || countdownEndsAtMs <= 0) {
      setCountdownSec(null);
      return;
    }
    const tick = () => {
      setCountdownSec(
        Math.max(0, Math.ceil((countdownEndsAtMs - Date.now()) / 1000)),
      );
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [phase, countdownEndsAtMs]);

  const courseLabel =
    stageTotal > 0
      ? t("courseProgress", {
          current: Math.min(stageIndex + 1, stageTotal),
          total: stageTotal,
        })
      : t("course");

  return (
    <div className="yanmar-mission-hud-panel relative w-full overflow-hidden rounded-xl border border-white/8 bg-black/15 text-white shadow-none backdrop-blur-[1px]">
      <div className="flex min-h-6 w-full items-center justify-between gap-1 px-1.5 py-1">
        <span className="min-w-0 text-[9px] font-black tabular-nums leading-tight">
          {courseLabel}
        </span>
        <span className="shrink-0 text-[8px] font-bold leading-none text-amber-200/85">
          {t("meet")}
        </span>
      </div>

      <div className="border-t border-white/10 px-1.5 pb-1.5 pt-1">
        <p className="truncate text-[8px] font-bold leading-snug text-white/70">
          {patternName}
        </p>
        <p className="mt-0.5 text-[9px] font-black leading-snug text-white">
          {stageLabel}
        </p>
        {progressLabel ? (
          <p className="mt-0.5 text-[8px] font-bold tabular-nums leading-snug text-white/80">
            {progressLabel}
          </p>
        ) : null}

        {phase === "racing" || phase === "finished" ? (
          <p className="mt-1 font-mono text-[15px] font-black tabular-nums leading-none text-amber-100">
            {formatTimeMs(liveElapsedMs)}
          </p>
        ) : null}

        {phase === "ready" ? (
          <p className="mt-1 text-[8px] font-bold leading-snug text-white/55">
            {t("waitingToStart")}
          </p>
        ) : null}

        {countdownSec != null && countdownSec > 0 ? (
          <p className="mt-1 text-center text-2xl font-black tabular-nums leading-none text-amber-300">
            {countdownSec}
          </p>
        ) : null}
        {countdownSec === 0 ? (
          <p className="mt-1 text-center text-lg font-black leading-none text-emerald-300">
            GO!
          </p>
        ) : null}

        <div className="pointer-events-auto mt-1.5 flex gap-1">
          {phase === "ready" ? (
            <button
              type="button"
              className="min-h-6 flex-1 rounded-md bg-amber-400 px-1 text-[9px] font-black text-slate-900 active:scale-95"
              onClick={onStart}
            >
              {t("start")}
            </button>
          ) : null}
          <button
            type="button"
            className="min-h-6 flex-1 rounded-md border border-white/25 bg-black/35 px-1 text-[9px] font-bold text-white active:scale-95"
            onClick={onExit}
          >
            {t("exit")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SportsMeetResultPanel({
  open,
  playMode,
  patternName,
  finalTimeMs,
  splits,
  submitted,
  onRetryPractice,
  onExit,
  onOpenRankings,
}: {
  open: boolean;
  playMode: SportsMeetPlayMode;
  patternName: string;
  finalTimeMs: number;
  splits: Array<{ stage: string; clearTimeMs: number; label: string }>;
  submitted: boolean;
  onRetryPractice: () => void;
  onExit: () => void;
  onOpenRankings: () => void;
}) {
  const t = useTranslations("yanmar.sportsMeet");
  if (!open) return null;

  let prev = 0;
  const rows = splits.map((s) => {
    const segment = Math.max(0, s.clearTimeMs - prev);
    prev = s.clearTimeMs;
    return { ...s, segmentMs: segment };
  });

  return (
    <div className="yanmar-unlock-overlay" role="presentation">
      <div
        className="yanmar-unlock-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t("resultAriaLabel")}
        style={{ maxWidth: "26rem" }}
      >
        <div className="yanmar-unlock-body">
          <h2 className="yanmar-unlock-title">{t("finish")}</h2>
          <p className="yanmar-unlock-lead">
            {patternName}
            <br />
            {playMode === "ranked"
              ? submitted
                ? t("rankingRecorded")
                : t("submittingRanking")
              : t("practiceNotRanked")}
          </p>
          <p className="mt-2 font-mono text-3xl font-black tabular-nums text-amber-200">
            {formatTimeMs(finalTimeMs)}
          </p>
          <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-white/10">
            <table className="w-full text-left text-xs text-white/90">
              <thead className="bg-black/40 text-white/60">
                <tr>
                  <th className="px-2 py-1.5">{t("course")}</th>
                  <th className="px-2 py-1.5">{t("segment")}</th>
                  <th className="px-2 py-1.5">{t("cumulative")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.stage}-${row.clearTimeMs}-${row.label}`} className="border-t border-white/5">
                    <td className="px-2 py-1.5 font-bold">{row.label}</td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {formatTimeMs(row.segmentMs)}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {formatTimeMs(row.clearTimeMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {playMode === "practice" ? (
              <button
                type="button"
                className="yanmar-unlock-cta"
                onClick={onRetryPractice}
              >
                {t("retryPractice")}
              </button>
            ) : (
              <button
                type="button"
                className="yanmar-unlock-cta"
                onClick={onOpenRankings}
              >
                {t("viewThisWeekRankings")}
              </button>
            )}
            <button
              type="button"
              className="rounded-lg border border-white/25 bg-white/5 px-4 py-2.5 text-sm font-bold text-white"
              onClick={onExit}
            >
              {t("returnToWorkshop")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
