"use client";

import { useEffect, useState } from "react";
import {
  formatSportsMeetRewardTiersKo,
  type SportsMeetPlayMode,
} from "./sportsMeet";

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
  const tiers = data?.rewardTiers ?? formatSportsMeetRewardTiersKo();

  return (
    <div className="yanmar-unlock-overlay" role="presentation">
      <div
        className="yanmar-unlock-panel"
        role="dialog"
        aria-modal="true"
        aria-label="굴착기 운동회 모드 선택"
        style={{ maxWidth: "26rem" }}
      >
        <header className="yanmar-unlock-brand">
          <span className="yanmar-unlock-brand-mark">YANMAR</span>
          <span className="yanmar-unlock-brand-rule" aria-hidden />
          <span className="yanmar-unlock-brand-sub">SPORTS MEET</span>
        </header>
        <div className="yanmar-unlock-body">
          <h2 className="yanmar-unlock-title">굴착기 운동회</h2>
          {loading ? (
            <p className="yanmar-unlock-lead">불러오는 중…</p>
          ) : error ? (
            <p className="yanmar-unlock-lead">{error}</p>
          ) : (
            <>
              <p className="yanmar-unlock-lead">
                이번 주 코스: <strong>{data?.patternName}</strong>
                <br />
                {data?.stageOrderLabel}
              </p>
              <p className="text-xs text-white/70">
                별10 · 덤프12000 · 파쇄12 · 돌5 · 월 0시(KST) 코스·보상 정산
              </p>
            </>
          )}

          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              className="yanmar-unlock-cta flex items-center justify-center gap-2"
              disabled={!data || remaining < 1}
              onClick={() => onEnter("ranked")}
            >
              <span
                className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-amber-700/40 bg-gradient-to-b from-amber-200 to-amber-400 px-1.5 text-[11px] font-black text-slate-900 shadow-sm"
                aria-hidden
              >
                TICKET
              </span>
              <span>랭킹 모드</span>
              <span className="rounded bg-black/25 px-1.5 py-0.5 font-mono text-xs tabular-nums">
                {remaining}/{limit}
              </span>
            </button>
            {data && remaining < 1 ? (
              <p className="text-center text-[11px] text-amber-200/90">
                내일 0시(KST)에 도전권이 초기화됩니다
                {data.ticket.resetInMs > 0
                  ? ` · 약 ${Math.ceil(data.ticket.resetInMs / 3_600_000)}시간 후`
                  : ""}
              </p>
            ) : (
              <p className="text-center text-[11px] text-white/55">
                도전권은 매일 0시(KST)에 1장 충전됩니다
              </p>
            )}
            <button
              type="button"
              className="rounded-lg border border-white/25 bg-white/5 px-4 py-2.5 text-sm font-bold text-white"
              onClick={() => onEnter("practice")}
            >
              연습 모드 · 기록 미반영
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-xs font-semibold text-white/90"
                onClick={() => onOpenRankings("current")}
              >
                이번 주 랭킹
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-xs font-semibold text-white/90"
                onClick={() => onOpenRankings("previous")}
              >
                지난주 랭킹
              </button>
            </div>
            <ul className="mt-1 space-y-0.5 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[10px] text-white/65">
              {tiers.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-1 text-xs font-semibold text-white/60 underline"
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
        className="yanmar-unlock-panel"
        role="dialog"
        aria-modal="true"
        aria-label="굴착기 운동회 랭킹"
        style={{ maxWidth: "28rem" }}
      >
        <div className="yanmar-unlock-body">
          <h2 className="yanmar-unlock-title">
            {week === "previous" ? "지난주 랭킹" : "이번 주 랭킹"}
          </h2>
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
                <p className="text-sm font-bold text-amber-200">
                  내 순위 {data.myStats.rank}위 ·{" "}
                  {data.myStats.bestTimeMs != null
                    ? formatTimeMs(data.myStats.bestTimeMs)
                    : "-"}
                  {data.myStats.rewardStars != null
                    ? ` · 보상 ${data.myStats.rewardStars}★`
                    : ""}
                </p>
              ) : (
                <p className="text-xs text-white/60">이번 주 기록이 없습니다</p>
              )}
              <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-white/10">
                {data.rankings.length === 0 ? (
                  <p className="p-3 text-center text-xs text-white/50">
                    기록이 없습니다
                  </p>
                ) : (
                  <table className="w-full text-left text-xs text-white/90">
                    <thead className="bg-black/40 text-white/60">
                      <tr>
                        <th className="px-2 py-1.5">순위</th>
                        <th className="px-2 py-1.5">닉네임</th>
                        <th className="px-2 py-1.5">시간</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rankings.map((row) => (
                        <tr key={row.rank} className="border-t border-white/5">
                          <td className="px-2 py-1.5 font-bold">{row.rank}</td>
                          <td className="px-2 py-1.5">{row.nickname}</td>
                          <td className="px-2 py-1.5 tabular-nums">
                            {formatTimeMs(row.bestTimeMs)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            <p className="yanmar-unlock-lead">랭킹을 불러오지 못했습니다.</p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-xs font-semibold text-white"
              onClick={() =>
                onSwitchWeek(week === "current" ? "previous" : "current")
              }
            >
              {week === "current" ? "지난주 랭킹" : "이번 주 랭킹"}
            </button>
            <button
              type="button"
              className="yanmar-unlock-cta flex-1"
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
  onStart,
  onExit,
}: {
  stageLabel: string;
  progressLabel: string;
  elapsedMs: number;
  countdownSec: number | null;
  phase: string;
  patternName: string;
  onStart: () => void;
  onExit: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 z-40 flex flex-col items-center gap-2 px-3">
      <div className="rounded-xl border border-amber-400/40 bg-slate-950/80 px-4 py-2 text-center text-white shadow-lg backdrop-blur-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/80">
          굴착기 운동회 · {patternName}
        </p>
        <p className="text-sm font-black">{stageLabel}</p>
        <p className="text-xs text-white/80">{progressLabel}</p>
        {phase === "racing" || phase === "finished" ? (
          <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-amber-100">
            {formatTimeMs(elapsedMs)}
          </p>
        ) : null}
        {countdownSec != null && countdownSec > 0 ? (
          <p className="mt-1 text-4xl font-black text-amber-300">{countdownSec}</p>
        ) : null}
        {countdownSec === 0 ? (
          <p className="mt-1 text-3xl font-black text-emerald-300">GO!</p>
        ) : null}
      </div>
      <div className="pointer-events-auto flex gap-2">
        {phase === "ready" ? (
          <button
            type="button"
            className="rounded-lg bg-amber-400 px-5 py-2 text-sm font-black text-slate-900"
            onClick={onStart}
          >
            시작
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-lg border border-white/30 bg-black/50 px-4 py-2 text-xs font-bold text-white"
          onClick={onExit}
        >
          나가기
        </button>
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
                  <tr key={row.stage} className="border-t border-white/5">
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
