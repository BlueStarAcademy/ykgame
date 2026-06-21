"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PhaserGameWrapper } from "@/components/games/PhaserGameWrapper";
import { RankingBoard } from "@/components/games/RankingBoard";
import type { GameId } from "@/lib/games";
import { getGameById } from "@/lib/games";
import type { GameResult } from "@/games/shared/types";
import { GameResultScreen } from "./GameResultScreen";

interface GamePlayClientProps {
  gameId: GameId;
}

interface MyStats {
  rank: number | null;
  bestScore: number;
  bestStars: number;
}

type GamePhase = "lobby" | "playing" | "result";

function controlLabel(type: string) {
  if (type === "dpad") return "🎮 D-pad 조작";
  if (type === "steering") return "🛞 조향 휠 조작";
  return "🔘 버튼 조작";
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}분 ${s > 0 ? `${s}초` : ""}`;
}

export function GamePlayClient({ gameId }: GamePlayClientProps) {
  const game = getGameById(gameId);
  const { data: session } = useSession();
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [result, setResult] = useState<GameResult | null>(null);
  const [myStats, setMyStats] = useState<MyStats>({
    rank: null,
    bestScore: 0,
    bestStars: 0,
  });
  const [showRanking, setShowRanking] = useState(false);

  const loadStats = useCallback(async () => {
    const res = await fetch(`/api/rankings/${gameId}`);
    const data = await res.json();
    if (data.myStats) {
      setMyStats(data.myStats);
    }
  }, [gameId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleStart = () => {
    setPhase("playing");
  };

  const handleGameEnd = (gameResult: GameResult) => {
    setResult(gameResult);
    setPhase("result");
  };

  const handleRetry = () => {
    setResult(null);
    setPhase("lobby");
    loadStats();
  };

  if (!game) return null;

  const nickname = session?.user?.nickname ?? "";

  if (phase === "result" && result) {
    return (
      <GameResultScreen
        gameId={gameId}
        result={result}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <>
      <Link
        href="/home"
        className="mb-3 inline-block text-sm text-blue-600 hover:underline"
      >
        ← 홈으로
      </Link>

      {phase === "lobby" && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
          <div
            className="px-5 py-4 text-white"
            style={{ backgroundColor: game.headerColor }}
          >
            <p className="text-xs opacity-90">{game.brandKo}</p>
            <h2 className="text-xl font-bold tracking-wide">{game.brandEn}</h2>
            <p className="mt-1 text-sm opacity-90">🎯 {game.mission}</p>
          </div>

          <div className="space-y-4 p-5">
            <div>
              <h3 className="text-sm font-bold text-gray-800">게임 설명</h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">
                {game.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">제한 시간</p>
                <p className="text-sm font-bold text-gray-800">
                  ⏱ {formatDuration(game.duration)}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">조작 방식</p>
                <p className="text-sm font-bold text-gray-800">
                  {controlLabel(game.controlType)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-center">
                <p className="text-xs text-blue-600">내 순위</p>
                <p className="text-lg font-bold text-blue-800">
                  {myStats.rank ? `#${myStats.rank}` : "-"}
                </p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3 text-center">
                <p className="text-xs text-amber-600">최고 점수</p>
                <p className="text-lg font-bold text-amber-800">
                  {myStats.bestScore > 0 ? `${myStats.bestScore}점` : "-"}
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowRanking(true)}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                📊 랭킹보드
              </button>
              <button
                onClick={handleStart}
                className="flex-[2] rounded-xl py-3 text-sm font-bold text-white shadow-md hover:opacity-90"
                style={{ backgroundColor: game.color }}
              >
                ▶ 시작하기
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "playing" && (
        <div>
          <div
            className="mb-2 flex items-center justify-between rounded-t-xl px-4 py-2.5 text-white"
            style={{ backgroundColor: game.headerColor }}
          >
            <div className="flex gap-4">
              <div>
                <p className="text-[10px] opacity-80">내 순위</p>
                <p className="text-sm font-bold">
                  {myStats.rank ? `#${myStats.rank}` : "-"}
                </p>
              </div>
              <div>
                <p className="text-[10px] opacity-80">최고 점수</p>
                <p className="text-sm font-bold">
                  {myStats.bestScore > 0 ? `${myStats.bestScore}점` : "-"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowRanking(true)}
              className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/30"
            >
              📊 랭킹보드
            </button>
          </div>

          <PhaserGameWrapper gameId={gameId} onEnd={handleGameEnd} />
        </div>
      )}

      <RankingBoard
        gameId={gameId}
        open={showRanking}
        onClose={() => setShowRanking(false)}
        highlightNickname={nickname}
      />
    </>
  );
}
