"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { GameId } from "@/lib/games";
import { getGameById, calculateStars } from "@/lib/games";
import type { GameResult } from "@/games/shared/types";
import { RankingBoard } from "./RankingBoard";

interface RankingEntry {
  rank: number;
  nickname: string;
  score: number;
  stars: number;
}

interface GameResultScreenProps {
  gameId: GameId;
  result: GameResult;
  onRetry?: () => void;
  onStay?: () => void;
  onExit?: () => void;
}

function medal(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}`;
}

export function GameResultScreen({ gameId, result, onRetry, onStay, onExit }: GameResultScreenProps) {
  const game = getGameById(gameId);
  const isYanmar = gameId === "yanmar";
  const isYanmarArcade = gameId === "yanmar" && typeof result.arcadeScore === "number";
  const stars = isYanmarArcade ? 0 : calculateStars(result.progress);
  const { data: session, update } = useSession();
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const savedRef = useRef(false);
  const updateRef = useRef(update);

  useEffect(() => {
    updateRef.current = update;
  }, [update]);

  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;

    async function saveAndLoad() {
      try {
        if (gameId === "yanmar" && result.mode !== "game") {
          setSaved(true);
          return;
        }
        const saveRes = await fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameId,
            progress: result.progress,
            playTime: result.playTime,
            timeLeft: result.timeLeft,
            arcadeScore: result.arcadeScore,
            dumpUnits: result.dumpUnits,
            mode: result.mode,
          }),
        });
        const saveData = await saveRes.json();
        setSaved(true);

        if (saveData.currency !== undefined) {
          await updateRef.current({ user: { currency: saveData.currency } });
        }

        const res = await fetch(`/api/rankings/${gameId}`);
        const data = await res.json();
        setRankings(data.rankings ?? []);
        setMyRank(data.myStats?.rank ?? null);
      } catch {
        savedRef.current = false;
      }
    }
    void saveAndLoad();
  }, [
    gameId,
    result.arcadeScore,
    result.dumpUnits,
    result.mode,
    result.progress,
    result.playTime,
    result.timeLeft,
  ]);

  const nickname = session?.user?.nickname ?? "";
  const title = isYanmar
    ? "운행 결과"
    : result.completed
      ? "미션 완료!"
      : "시간 종료";
  const homeLabel = isYanmar ? "나가기" : "홈으로";
  const myRankingEntry = myRank
    ? rankings.find((entry) => entry.rank === myRank) ?? null
    : null;
  const yRankingRows = rankings.slice(0, 10);
  const resultCard = (
    <div className="mx-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
      <h2 className="text-center text-xl font-bold" style={{ color: game?.color }}>
        {title}
      </h2>
      <p className="mt-1 text-center text-sm text-gray-500">{game?.brandEn}</p>

      <div className="my-6 text-center">
        {!isYanmar ? (
          <p className="text-4xl text-yellow-400">
            {"★".repeat(stars)}
            {"☆".repeat(3 - stars)}
          </p>
        ) : null}
        <p className="mt-2 text-2xl font-bold text-gray-800">
          {isYanmarArcade
            ? `누적 하역량 ${(result.dumpUnits ?? 0).toLocaleString()}`
            : `${result.progress}%`}
        </p>
        <p className="text-sm text-gray-500">
          플레이 시간 {result.playTime}초
          {result.timeLeft > 0 ? ` · 남은 시간 ${result.timeLeft}초` : ""}
        </p>
        {!isYanmar && saved && stars > 0 && (
          <p className="mt-2 text-sm text-green-600">⭐ {stars}별 획득!</p>
        )}
        {saved && myRank && (
          <p className="mt-1 text-sm text-blue-600">이번 달 순위 #{myRank}</p>
        )}
        {isYanmar && result.mode !== "game" && (
          <p className="mt-2 text-xs text-gray-400">연습 운행 결과는 랭킹에 저장되지 않습니다.</p>
        )}
      </div>

      <div className="mb-4 rounded-xl bg-gray-50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700">
            {isYanmar ? "누적 하역량 Top 10" : "이번 달 Top 10"}
          </h3>
          {!isYanmar ? (
            <button
              onClick={() => setShowRanking(true)}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              전체 보기
            </button>
          ) : null}
        </div>
        {isYanmar ? (
          <>
            <div className="mb-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-blue-800">
                  나의 순위 {myRank ? `#${myRank}` : "기록 없음"}
                </span>
                <span className="shrink-0 font-black text-blue-900">
                  {(myRankingEntry?.score ?? result.dumpUnits ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
            {yRankingRows.length === 0 ? (
              <p className="text-xs text-gray-400">랭킹 데이터 없음</p>
            ) : (
              <ul className="h-[10.75rem] space-y-1.5 overflow-y-auto pr-1 [-webkit-overflow-scrolling:touch]">
                {yRankingRows.map((r) => (
                  <li
                    key={r.rank}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                      r.rank === myRank ? "bg-blue-100 text-blue-900" : "bg-white text-gray-700"
                    }`}
                  >
                    <span className="min-w-0 truncate">
                      {medal(r.rank)} {r.nickname}
                    </span>
                    <span className="shrink-0 font-semibold">{r.score.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : rankings.length === 0 ? (
          <p className="text-xs text-gray-400">랭킹 데이터 없음</p>
        ) : (
          <ul className="space-y-1">
            {rankings.slice(0, 5).map((r) => (
              <li key={r.rank} className="flex justify-between text-sm">
                <span>
                  {medal(r.rank)} {r.nickname}
                </span>
                <span className="text-gray-600">{r.score}점</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2">
        {isYanmar && onStay ? (
          <button
            onClick={onStay}
            className="flex-1 rounded-lg bg-gray-200 py-3 text-center font-medium text-gray-700 hover:bg-gray-300"
          >
            머무르기
          </button>
        ) : onRetry ? (
          <button
            onClick={onRetry}
            className="flex-1 rounded-lg bg-gray-200 py-3 text-center font-medium text-gray-700 hover:bg-gray-300"
          >
            재시도
          </button>
        ) : (
          <Link
            href={`/games/${gameId}`}
            className="flex-1 rounded-lg bg-gray-200 py-3 text-center font-medium text-gray-700 hover:bg-gray-300"
          >
            재시도
          </Link>
        )}
        {onExit ? (
          <button
            type="button"
            onClick={onExit}
            className="flex-1 rounded-lg py-3 text-center font-medium text-white hover:opacity-90"
            style={{ backgroundColor: game?.color }}
          >
            {homeLabel}
          </button>
        ) : (
          <Link
            href="/home"
            className="flex-1 rounded-lg py-3 text-center font-medium text-white hover:opacity-90"
            style={{ backgroundColor: game?.color }}
          >
            {homeLabel}
          </Link>
        )}
      </div>
      {!saved && (
        <p className="mt-2 text-center text-xs text-gray-400">점수 저장 중...</p>
      )}
    </div>
  );

  return (
    <>
      {isYanmar ? (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]">
          {resultCard}
        </div>
      ) : (
        resultCard
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
