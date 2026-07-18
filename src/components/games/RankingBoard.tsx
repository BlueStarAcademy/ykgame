"use client";

import { useEffect, useState } from "react";
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
}: {
  entry: RankingEntry;
  gameId: GameId;
  isMe?: boolean;
}) {
  const isYanmar = gameId === "yanmar";
  const isTop3 = entry.rank > 0 && entry.rank <= 3;

  return (
    <li
      className={`ranking-modal-row flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${
        isMe ? "ranking-modal-row-me" : isTop3 ? "ranking-modal-row-top" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <RankBadge rank={entry.rank} tone="light" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-800">
            {entry.nickname}
            {isMe ? (
              <span className="ml-1 text-[10px] font-bold text-blue-600">나</span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {isYanmar ? (
              "누적 점수"
            ) : (
              <>
                <span className="text-amber-500">
                  {"★".repeat(entry.stars)}
                  {"☆".repeat(3 - entry.stars)}
                </span>
                <span className="mx-1 text-slate-300">·</span>
                ⏱ {formatTime(entry.playTime)}
              </>
            )}
          </p>
        </div>
      </div>
      <span className="shrink-0 text-sm font-black text-slate-900">
        {entry.score > 0 ? entry.score.toLocaleString() : "-"}
        {entry.score > 0 ? (
          <span className="ml-0.5 text-[10px] font-semibold text-slate-400">점</span>
        ) : null}
      </span>
    </li>
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
    return <p className="py-8 text-center text-sm text-slate-400">불러오는 중...</p>;
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
      <p className="py-8 text-center text-sm text-slate-400">아직 랭킹 기록이 없습니다.</p>
    );
  }

  return (
    <div className="space-y-2">
      {myEntry ? (
        <div>
          <p className="mb-1 px-1 text-[10px] font-bold text-slate-400">내 순위</p>
          <ul>
            <RankingRow entry={myEntry} gameId={gameId} isMe />
          </ul>
        </div>
      ) : null}
      {top10.length > 0 ? (
        <div>
          {myEntry ? (
            <p className="mb-1 px-1 text-[10px] font-bold text-slate-400">TOP 10</p>
          ) : null}
          <ul className="space-y-1.5">
            {top10.map((r) => (
              <RankingRow
                key={`${r.rank}-${r.nickname}`}
                entry={r}
                gameId={gameId}
                isMe={myEntry?.nickname === r.nickname}
              />
            ))}
          </ul>
        </div>
      ) : myEntry ? (
        <p className="py-4 text-center text-xs text-slate-400">아직 TOP 10 기록이 없습니다.</p>
      ) : null}
    </div>
  );
}

export function RankingBoardPanel({
  gameId,
  highlightNickname,
  active = true,
  embedded = false,
  onClose,
}: RankingBoardPanelProps) {
  const game = getGameById(gameId);
  const { rankings, myStats, seasonLabel, seasonEndsAt, loading } = useRankings(
    gameId,
    active,
  );
  const seasonRemaining = useSeasonRemaining(seasonEndsAt, active);

  const headerColor = game?.headerColor ?? "#1565C0";
  const brandColor = game?.color ?? headerColor;

  const periodTitle = seasonLabel ? `${seasonLabel} 랭킹 Top 10` : "랭킹 Top 10";

  const header = (
    <div
      className="ranking-embed-header relative shrink-0 overflow-hidden px-4 py-2.5 text-white"
      style={{
        background: `linear-gradient(135deg, ${brandColor} 0%, ${headerColor} 55%, #0f172a 100%)`,
      }}
    >
      <div className="flex items-center gap-2">
        <h3
          id={onClose ? "ranking-modal-title" : undefined}
          className="min-w-0 flex-1 truncate text-sm font-black"
        >
          {periodTitle}
        </h3>
        {seasonRemaining ? (
          <span className="shrink-0 text-[10px] font-bold text-white/85">{seasonRemaining}</span>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-white/20 bg-white/15 px-2 py-1 text-[10px] font-bold hover:bg-white/25"
          >
            닫기
          </button>
        ) : null}
      </div>
    </div>
  );

  const body = (
    <div className="ranking-embed-body min-h-0 flex-1 overflow-y-auto overscroll-contain p-2.5 [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
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
      className={`game-lobby-ranking-embed flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm ${
        embedded ? "h-full" : "max-h-full ranking-modal-card"
      }`}
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
      className="ranking-modal-overlay fixed inset-0 z-[280] flex items-start justify-center overflow-y-auto overscroll-contain p-3 [-webkit-overflow-scrolling:touch] [touch-action:pan-y] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="ranking-modal-panel my-auto flex max-h-[min(92dvh,40rem)] w-full max-w-md flex-col overflow-hidden p-1 landscape:max-h-[min(94dvh,24rem)]"
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
