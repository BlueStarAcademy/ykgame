"use client";

import { useState } from "react";
import { RankingBoard } from "@/components/games/RankingBoard";

interface HomeProfilePanelProps {
  nickname: string;
  cumulativeScore: number;
  rank: number | null;
}

export function HomeProfilePanel({
  nickname,
  cumulativeScore,
  rank,
}: HomeProfilePanelProps) {
  const [rankingOpen, setRankingOpen] = useState(false);

  return (
    <>
      <div className="home-profile-panel flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
          {nickname.charAt(0)}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-snug text-slate-900">{nickname}</p>
          <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-slate-500">
            누적{" "}
            <span className="font-bold text-slate-800">
              {cumulativeScore > 0 ? cumulativeScore.toLocaleString() : "—"}
            </span>
            <span className="mx-1 text-slate-300">·</span>
            랭킹{" "}
            <span className="font-bold text-slate-800">{rank ? `#${rank}` : "—"}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRankingOpen(true)}
          className="shrink-0 self-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold leading-none text-slate-700 transition hover:bg-slate-100"
        >
          📊 랭킹
        </button>
      </div>

      <RankingBoard
        gameId="yanmar"
        open={rankingOpen}
        onClose={() => setRankingOpen(false)}
        highlightNickname={nickname}
      />
    </>
  );
}
