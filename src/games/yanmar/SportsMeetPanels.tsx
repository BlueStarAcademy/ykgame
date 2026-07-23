"use client";

import { useEffect, useState } from "react";
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

function formatRewardRankLabel(minRank: number, maxRank: number) {
  if (minRank === maxRank) return `${minRank}위`;
  if (maxRank === Number.POSITIVE_INFINITY) return `${minRank}위~`;
  return `${minRank}~${maxRank}위`;
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
        if (!res.ok) throw new Error("티켓 정보를 불러오지 못했습니다.");
        return (await res.json()) as TicketPayload;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "오류");
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
        aria-label="굴착기 운동회"
      >
        <button
          type="button"
          className="yanmar-sports-meet-entry-close"
          onClick={onClose}
          aria-label="닫기"
        >
          ×
        </button>
        <div className="yanmar-unlock-body yanmar-sports-meet-entry-body">
          <h2 className="yanmar-unlock-title yanmar-sports-meet-entry-title">
            굴착기 운동회
          </h2>

          {loading ? (
            <p className="yanmar-unlock-lead">불러오는 중…</p>
          ) : error ? (
            <p className="yanmar-unlock-lead">{error}</p>
          ) : (
            <div className="yanmar-sports-meet-entry-grid">
              <section className="yanmar-sports-meet-entry-card yanmar-sports-meet-entry-course">
                <h3 className="yanmar-sports-meet-entry-card-title">
                  이번 주 코스
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
                  순위별 보상
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
                            {formatRewardRankLabel(tier.minRank, tier.maxRank)}
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
                  월요일 0시 코스 초기화 · 지난주 순위 보상 지급
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
              이번 주 랭킹
            </button>
            <button
              type="button"
              className="yanmar-sports-meet-entry-rank-btn"
              onClick={() => onOpenRankings("previous")}
            >
              지난주 랭킹
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
                랭킹모드
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
              연습모드
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
        aria-label="굴착기 운동회 랭킹"
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
            {week === "previous" ? "지난주 랭킹" : "이번 주 랭킹"}
          </h2>

          <div className="yanmar-sports-meet-rankings-meta">
            {loading ? (
              <p className="yanmar-unlock-lead">불러오는 중…</p>
            ) : data ? (
              <>
                <p className="yanmar-unlock-lead">
                  {data.weekKey} · {data.patternName}
                  <br />
                  {data.stageOrderLabel}
                </p>
                {data.myStats?.rank != null ? (
                  <p className="yanmar-sports-meet-rankings-mine">
                    내 순위 {data.myStats.rank}위 ·{" "}
                    {data.myStats.bestTimeMs != null
                      ? formatTimeMs(data.myStats.bestTimeMs)
                      : "-"}
                    {data.myStats.rewardStars != null
                      ? ` · 보상 ${data.myStats.rewardStars.toLocaleString()}★`
                      : ""}
                  </p>
                ) : (
                  <p className="yanmar-sports-meet-rankings-empty">
                    {week === "previous"
                      ? "지난주 기록이 없습니다"
                      : "이번 주 기록이 없습니다"}
                  </p>
                )}
              </>
            ) : (
              <p className="yanmar-unlock-lead">랭킹을 불러오지 못했습니다.</p>
            )}
          </div>

          <div className="yanmar-sports-meet-rankings-table-wrap">
            {loading ? (
              <p className="yanmar-sports-meet-rankings-placeholder">
                불러오는 중…
              </p>
            ) : !data ? (
              <p className="yanmar-sports-meet-rankings-placeholder">
                랭킹을 불러오지 못했습니다.
              </p>
            ) : data.rankings.length === 0 ? (
              <p className="yanmar-sports-meet-rankings-placeholder">
                기록이 없습니다
              </p>
            ) : (
              <table className="yanmar-sports-meet-rankings-table">
                <thead>
                  <tr>
                    <th>순위</th>
                    <th>닉네임</th>
                    <th>시간</th>
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
              {week === "current" ? "지난주 랭킹" : "이번 주 랭킹"}
            </button>
            <button
              type="button"
              className="yanmar-sports-meet-rankings-action-btn yanmar-sports-meet-rankings-action-btn--close"
              onClick={onClose}
            >
              닫기
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
  countdownSec,
  phase,
  patternName,
  stageIndex,
  stageTotal,
  onStart,
  onExit,
}: {
  stageLabel: string;
  progressLabel: string;
  elapsedMs: number;
  countdownSec: number | null;
  phase: string;
  patternName: string;
  stageIndex: number;
  stageTotal: number;
  onStart: () => void;
  onExit: () => void;
}) {
  const courseLabel =
    stageTotal > 0
      ? `코스 ${Math.min(stageIndex + 1, stageTotal)}/${stageTotal}`
      : "코스";

  return (
    <div className="yanmar-mission-hud-panel relative w-full overflow-hidden rounded-xl border border-white/8 bg-black/15 text-white shadow-none backdrop-blur-[1px]">
      <div className="flex min-h-6 w-full items-center justify-between gap-1 px-1.5 py-1">
        <span className="min-w-0 text-[9px] font-black tabular-nums leading-tight">
          {courseLabel}
        </span>
        <span className="shrink-0 text-[8px] font-bold leading-none text-amber-200/85">
          운동회
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
            {formatTimeMs(elapsedMs)}
          </p>
        ) : null}

        {phase === "ready" ? (
          <p className="mt-1 text-[8px] font-bold leading-snug text-white/55">
            시작 대기
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
              시작
            </button>
          ) : null}
          <button
            type="button"
            className="min-h-6 flex-1 rounded-md border border-white/25 bg-black/35 px-1 text-[9px] font-bold text-white active:scale-95"
            onClick={onExit}
          >
            나가기
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
        aria-label="굴착기 운동회 결과"
        style={{ maxWidth: "26rem" }}
      >
        <div className="yanmar-unlock-body">
          <h2 className="yanmar-unlock-title">완주!</h2>
          <p className="yanmar-unlock-lead">
            {patternName}
            <br />
            {playMode === "ranked"
              ? submitted
                ? "랭킹에 기록이 반영되었습니다"
                : "랭킹 제출 중…"
              : "연습 기록 · 랭킹 미반영"}
          </p>
          <p className="mt-2 font-mono text-3xl font-black tabular-nums text-amber-200">
            {formatTimeMs(finalTimeMs)}
          </p>
          <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-white/10">
            <table className="w-full text-left text-xs text-white/90">
              <thead className="bg-black/40 text-white/60">
                <tr>
                  <th className="px-2 py-1.5">코스</th>
                  <th className="px-2 py-1.5">구간</th>
                  <th className="px-2 py-1.5">누적</th>
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
                연습 다시하기
              </button>
            ) : (
              <button
                type="button"
                className="yanmar-unlock-cta"
                onClick={onOpenRankings}
              >
                이번 주 랭킹 보기
              </button>
            )}
            <button
              type="button"
              className="rounded-lg border border-white/25 bg-white/5 px-4 py-2.5 text-sm font-bold text-white"
              onClick={onExit}
            >
              작업장으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
