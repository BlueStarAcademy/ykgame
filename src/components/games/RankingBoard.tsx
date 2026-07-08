"use client";

import { useEffect, useState } from "react";
import type { GameId } from "@/lib/games";
import { getGameById } from "@/lib/games";

export interface RankingEntry {
  rank: number;
  nickname: string;
  score: number;
  stars: number;
  playTime: number;
}

interface RankingBoardProps {
  gameId: GameId;
  open: boolean;
  onClose: () => void;
  highlightNickname?: string;
}

function medal(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}`;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function RankingBoard({
  gameId,
  open,
  onClose,
  highlightNickname,
}: RankingBoardProps) {
  const game = getGameById(gameId);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [monthKey, setMonthKey] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    fetch(`/api/rankings/${gameId}`)
      .then((res) => res.json())
      .then((data) => {
        setRankings(data.rankings ?? []);
        setMonthKey(data.monthKey ?? "");
      })
      .finally(() => setLoading(false));
  }, [gameId, open]);

  if (!open) return null;

  const headerColor = game?.headerColor ?? "#1565C0";
  const brandColor = game?.color ?? headerColor;

  return (
    <div
      className="ranking-modal-overlay fixed inset-0 z-[220] flex items-start justify-center overflow-y-auto overscroll-contain p-3 [-webkit-overflow-scrolling:touch] [touch-action:pan-y] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="ranking-modal-panel my-auto flex max-h-[min(92dvh,40rem)] w-full max-w-md flex-col overflow-hidden landscape:max-h-[min(94dvh,24rem)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ranking-modal-title"
      >
        <div
          className="ranking-modal-header relative shrink-0 overflow-hidden px-5 py-4 text-white"
          style={{
            background: `linear-gradient(135deg, ${brandColor} 0%, ${headerColor} 55%, #0f172a 100%)`,
          }}
        >
          <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/70">
                Leaderboard
              </p>
              <h3 id="ranking-modal-title" className="mt-0.5 text-lg font-black">
                {game?.brandEn} 랭킹
              </h3>
              <p className="mt-1 text-[11px] text-white/75">
                {monthKey ? `${monthKey} 월간 순위` : "이번 달 순위"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg border border-white/20 bg-white/15 px-2.5 py-1 text-xs font-bold hover:bg-white/25"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="ranking-modal-body min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-400">불러오는 중...</p>
          ) : rankings.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              아직 랭킹 기록이 없습니다.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {rankings.map((r) => {
                const isMe = highlightNickname && r.nickname === highlightNickname;
                const isTop3 = r.rank <= 3;
                return (
                  <li
                    key={`${r.rank}-${r.nickname}`}
                    className={`ranking-modal-row flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${
                      isMe ? "ranking-modal-row-me" : isTop3 ? "ranking-modal-row-top" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black ${
                          isTop3
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {medal(r.rank)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {r.nickname}
                          {isMe ? (
                            <span className="ml-1 text-[10px] font-bold text-blue-600">나</span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          <span className="text-amber-500">
                            {"★".repeat(r.stars)}
                            {"☆".repeat(3 - r.stars)}
                          </span>
                          <span className="mx-1 text-slate-300">·</span>
                          ⏱ {formatTime(r.playTime)}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-black text-slate-900">
                      {r.score.toLocaleString()}
                      <span className="ml-0.5 text-[10px] font-semibold text-slate-400">점</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
