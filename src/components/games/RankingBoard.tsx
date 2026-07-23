"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { GameId } from "@/lib/games";
import { formatSeasonRemaining, getGameById } from "@/lib/games";
import { RankBadge } from "@/components/games/RankBadge";
import { useRegisterInGameBackDismiss } from "@/hooks/useInGameBackNavigation";

export interface RankingEntry {
  rank: number;
  nickname: string;
  score: number;
  stars: number;
  playTime: number;
}

interface MyRankingStats {
  rank: number | null;
  nickname: string;
  bestScore: number;
  bestStars: number;
  playTime: number;
}

interface RankingBoardPanelProps {
  gameId: GameId;
  highlightNickname?: string;
  active?: boolean;
  embedded?: boolean;
  onClose?: () => void;
}

interface RankingBoardProps {
  gameId: GameId;
  open: boolean;
  onClose: () => void;
  highlightNickname?: string;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function useSeasonRemaining(endsAt: string | null, active: boolean) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    if (!endsAt || !active) return;

    const endDate = new Date(endsAt);
    const update = () => setRemaining(formatSeasonRemaining(endDate));
    update();

    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [endsAt, active]);

  return remaining;
}

function useRankings(gameId: GameId, active: boolean) {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [myStats, setMyStats] = useState<MyRankingStats | null>(null);
  const [seasonLabel, setSeasonLabel] = useState("");
  const [seasonEndsAt, setSeasonEndsAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;

    setLoading(true);
    fetch(`/api/rankings/${gameId}`)
      .then((res) => res.json())
      .then((data) => {
        setRankings((data.rankings ?? []).slice(0, 10));
        setMyStats(data.myStats ?? null);
        setSeasonLabel(data.seasonLabel ?? "");
        setSeasonEndsAt(data.seasonEndsAt ?? null);
      })
      .finally(() => setLoading(false));
  }, [gameId, active]);

  return { rankings, myStats, seasonLabel, seasonEndsAt, loading };
}

function RankingRow({
  entry,
  gameId,
  isMe = false,
  index = 0,
}: {
  entry: RankingEntry;
  gameId: GameId;
  isMe?: boolean;
  index?: number;
}) {
  const isYanmar = gameId === "yanmar";
  const isTop3 = entry.rank > 0 && entry.rank <= 3;

  return (
    <li
      className={`ranking-modal-row flex items-center justify-between gap-3 ${
        isMe ? "ranking-modal-row-me" : isTop3 ? "ranking-modal-row-top" : ""
      }`}
      style={{ animationDelay: `${Math.min(index, 9) * 28}ms` }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <RankBadge rank={entry.rank} tone="light" />
        <div className="min-w-0">
          <p className="ranking-modal-row-name truncate">
            {entry.nickname}
            {isMe ? <span className="ranking-modal-me-tag">나</span> : null}
          </p>
          <p className="ranking-modal-row-meta">
            {isYanmar ? (
              "누적 점수"
            ) : (
              <>
                <span className="text-amber-500">
                  {"★".repeat(entry.stars)}
                  {"☆".repeat(3 - entry.stars)}
                </span>
                <span className="mx-1 opacity-40">·</span>
                ⏱ {formatTime(entry.playTime)}
              </>
            )}
          </p>
        </div>
      </div>
      <span className="ranking-modal-row-score shrink-0 tabular-nums">
        {entry.score > 0 ? entry.score.toLocaleString() : "—"}
        {entry.score > 0 ? <span className="ranking-modal-row-unit">점</span> : null}
      </span>
    </li>
  );
}

function RankingListSkeleton() {
  return (
    <div className="ranking-modal-skeleton" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="ranking-modal-skeleton-row" />
      ))}
    </div>
  );
}

function RankingList({
  rankings,
  myStats,
  loading,
  gameId,
}: {
  rankings: RankingEntry[];
  myStats: MyRankingStats | null;
  loading: boolean;
  gameId: GameId;
}) {
  if (loading) {
    return <RankingListSkeleton />;
  }

  const myEntry = myStats
    ? {
        rank: myStats.rank ?? 0,
        nickname: myStats.nickname,
        score: myStats.bestScore,
        stars: myStats.bestStars,
        playTime: myStats.playTime,
      }
    : null;

  const top10 = rankings.filter((r) => !myEntry || r.nickname !== myEntry.nickname);

  if (!myEntry && top10.length === 0) {
    return (
      <div className="ranking-modal-empty">
        <p className="ranking-modal-empty-title">아직 기록이 없습니다</p>
        <p className="ranking-modal-empty-desc">첫 플레이로 시즌 순위에 이름을 올려보세요.</p>
      </div>
    );
  }

  return (
    <div className="ranking-modal-sections">
      {myEntry ? (
        <section className="ranking-modal-section">
          <div className="ranking-modal-section-label">
            <span>내 순위</span>
          </div>
          <ul>
            <RankingRow entry={myEntry} gameId={gameId} isMe />
          </ul>
        </section>
      ) : null}
      {top10.length > 0 ? (
        <section className="ranking-modal-section ranking-modal-section-list">
          {myEntry ? (
            <div className="ranking-modal-section-label">
              <span>TOP 10</span>
            </div>
          ) : null}
          <ul className="ranking-modal-list">
            {top10.map((r, index) => (
              <RankingRow
                key={`${r.rank}-${r.nickname}`}
                entry={r}
                gameId={gameId}
                isMe={myEntry?.nickname === r.nickname}
                index={index}
              />
            ))}
          </ul>
        </section>
      ) : myEntry ? (
        <p className="ranking-modal-empty-inline">아직 TOP 10 기록이 없습니다.</p>
      ) : null}
    </div>
  );
}

function useSportsMeetRankings(active: boolean, week: "current" | "previous") {
  const [rankings, setRankings] = useState<
    Array<{ rank: number; nickname: string; bestTimeMs: number }>
  >([]);
  const [myStats, setMyStats] = useState<{
    rank: number | null;
    bestTimeMs: number | null;
    rewardStars: number | null;
  } | null>(null);
  const [meta, setMeta] = useState<{
    weekKey: string;
    patternName: string;
    stageOrderLabel: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    fetch(`/api/sports-meet/yanmar/rankings?week=${week}`)
      .then((res) => res.json())
      .then((data) => {
        setRankings(data.rankings ?? []);
        setMyStats(data.myStats ?? null);
        setMeta({
          weekKey: data.weekKey ?? "",
          patternName: data.patternName ?? "",
          stageOrderLabel: data.stageOrderLabel ?? "",
        });
      })
      .finally(() => setLoading(false));
  }, [active, week]);

  return { rankings, myStats, meta, loading };
}

function formatSportsTimeMs(ms: number) {
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = totalSec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

export function RankingBoardPanel({
  gameId,
  highlightNickname: _highlightNickname,
  active = true,
  embedded = false,
  onClose,
}: RankingBoardPanelProps) {
  const game = getGameById(gameId);
  const isYanmar = gameId === "yanmar";
  const [boardTab, setBoardTab] = useState<"season" | "sports">("season");
  const [sportsWeek, setSportsWeek] = useState<"current" | "previous">(
    "current",
  );

  const { rankings, myStats, seasonLabel, seasonEndsAt, loading } = useRankings(
    gameId,
    active && (!isYanmar || boardTab === "season"),
  );
  const sports = useSportsMeetRankings(
    active && isYanmar && boardTab === "sports",
    sportsWeek,
  );
  const seasonRemaining = useSeasonRemaining(
    seasonEndsAt,
    active && (!isYanmar || boardTab === "season"),
  );

  const headerColor = game?.headerColor ?? "#1565C0";
  const brandColor = game?.color ?? headerColor;
  const periodTitle =
    isYanmar && boardTab === "sports"
      ? sportsWeek === "previous"
        ? "지난주 운동회"
        : "주간 굴착기 운동회"
      : seasonLabel
        ? `${seasonLabel} 랭킹`
        : "시즌 랭킹";
  const brandVars = {
    "--ranking-brand": brandColor,
    "--ranking-header": headerColor,
  } as CSSProperties;

  const header = (
    <header className="ranking-modal-header">
      <div className="ranking-modal-header-glow" aria-hidden />
      <div className="ranking-modal-header-grid" aria-hidden />
      <div className="ranking-modal-header-top">
        <p className="ranking-modal-eyebrow">
          {isYanmar && boardTab === "sports" ? "Sports Meet" : "Season Ranking"}
        </p>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="ranking-modal-close"
            aria-label="닫기"
          >
            ✕
          </button>
        ) : null}
      </div>
      <div className="ranking-modal-header-main">
        <h3
          id={onClose ? "ranking-modal-title" : undefined}
          className="ranking-modal-title"
        >
          {periodTitle}
        </h3>
        {boardTab === "season" && seasonRemaining ? (
          <span className="ranking-modal-timer" title="시즌 종료까지">
            <span className="ranking-modal-timer-dot" aria-hidden />
            {seasonRemaining}
          </span>
        ) : null}
      </div>
      {isYanmar ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${
              boardTab === "season"
                ? "bg-white/20 text-white"
                : "bg-black/25 text-white/70"
            }`}
            onClick={() => setBoardTab("season")}
          >
            시즌 누적
          </button>
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${
              boardTab === "sports"
                ? "bg-white/20 text-white"
                : "bg-black/25 text-white/70"
            }`}
            onClick={() => setBoardTab("sports")}
          >
            주간 운동회
          </button>
          {boardTab === "sports" ? (
            <button
              type="button"
              className="ml-auto rounded-md bg-black/25 px-2.5 py-1 text-[11px] font-semibold text-white/80"
              onClick={() =>
                setSportsWeek((w) =>
                  w === "current" ? "previous" : "current",
                )
              }
            >
              {sportsWeek === "current" ? "지난주 보기" : "이번 주 보기"}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="ranking-modal-subtitle">Top 10 · 실시간 누적 순위</p>
      )}
      {isYanmar && boardTab === "sports" && sports.meta ? (
        <p className="ranking-modal-subtitle mt-1">
          {sports.meta.weekKey} · {sports.meta.patternName} ·{" "}
          {sports.meta.stageOrderLabel}
        </p>
      ) : isYanmar && boardTab === "season" ? (
        <p className="ranking-modal-subtitle">Top 10 · 시즌 누적 점수</p>
      ) : null}
    </header>
  );

  const sportsBody = (
    <div className="ranking-modal-body">
      {sports.loading ? (
        <p className="ranking-modal-empty-inline">불러오는 중…</p>
      ) : (
        <>
          {sports.myStats?.rank != null ? (
            <p className="mb-2 text-sm font-bold text-amber-100">
              내 순위 {sports.myStats.rank}위 ·{" "}
              {sports.myStats.bestTimeMs != null
                ? formatSportsTimeMs(sports.myStats.bestTimeMs)
                : "-"}
              {sports.myStats.rewardStars != null
                ? ` · 보상 ${sports.myStats.rewardStars}★`
                : ""}
            </p>
          ) : null}
          {sports.rankings.length === 0 ? (
            <p className="ranking-modal-empty-inline">아직 기록이 없습니다.</p>
          ) : (
            <ul className="ranking-modal-list">
              {sports.rankings.slice(0, 10).map((row, index) => (
                <li
                  key={`${row.rank}-${row.nickname}`}
                  className="ranking-modal-row flex items-center justify-between gap-3"
                  style={{ animationDelay: `${Math.min(index, 9) * 28}ms` }}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <RankBadge rank={row.rank} tone="light" />
                    <p className="ranking-modal-row-name truncate">
                      {row.nickname}
                    </p>
                  </div>
                  <p className="ranking-modal-row-score tabular-nums">
                    {formatSportsTimeMs(row.bestTimeMs)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );

  const body =
    isYanmar && boardTab === "sports" ? (
      sportsBody
    ) : (
      <div className="ranking-modal-body">
        <RankingList
          rankings={rankings}
          myStats={myStats}
          loading={loading}
          gameId={gameId}
        />
      </div>
    );

  return (
    <div
      className={`game-lobby-ranking-embed ranking-modal-card flex min-h-0 flex-col overflow-hidden ${
        embedded ? "h-full ranking-modal-card-embedded" : "h-full"
      }`}
      style={brandVars}
    >
      {header}
      {body}
    </div>
  );
}

export function RankingBoard({
  gameId,
  open,
  onClose,
  highlightNickname,
}: RankingBoardProps) {
  const [mounted, setMounted] = useState(false);

  useRegisterInGameBackDismiss(open, onClose);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="ranking-modal-overlay"
      onClick={onClose}
      role="presentation"
      style={
        {
          "--ranking-brand":
            getGameById(gameId)?.color ?? "#E53935",
        } as CSSProperties
      }
    >
      <div
        className="ranking-modal-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ranking-modal-title"
      >
        <RankingBoardPanel
          gameId={gameId}
          highlightNickname={highlightNickname}
          active={open}
          onClose={onClose}
        />
      </div>
    </div>,
    document.body,
  );
}
