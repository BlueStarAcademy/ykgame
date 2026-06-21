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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 text-white"
          style={{ backgroundColor: game?.headerColor ?? "#1565C0" }}
        >
          <div>
            <h3 className="text-lg font-bold">{game?.brandEn} 랭킹</h3>
            <p className="text-xs opacity-90">
              {monthKey ? `${monthKey} 월간 순위` : "이번 달 순위"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white/20 px-3 py-1 text-sm hover:bg-white/30"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-gray-400">불러오는 중...</p>
          ) : rankings.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              아직 랭킹 기록이 없습니다.
            </p>
          ) : (
            <ul className="space-y-2">
              {rankings.map((r) => {
                const isMe = highlightNickname && r.nickname === highlightNickname;
                return (
                  <li
                    key={`${r.rank}-${r.nickname}`}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                      isMe ? "bg-blue-50 ring-2 ring-blue-300" : "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-center text-lg font-bold text-gray-700">
                        {medal(r.rank)}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {r.nickname}
                          {isMe && (
                            <span className="ml-1 text-xs text-blue-600">(나)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {"★".repeat(r.stars)}
                          {"☆".repeat(3 - r.stars)} · ⏱ {formatTime(r.playTime)}
                        </p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-gray-800">
                      {r.score}점
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
