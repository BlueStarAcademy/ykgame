"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { GameId } from "@/lib/games";
import { getGameById, calculateStars } from "@/lib/games";
import type { GameResult } from "@/games/shared/types";
import { commitYanmarGameSessionScore } from "@/games/yanmar/gameSessionPersistence";
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
  onScoreSaved?: (score: number) => void;
}

function medal(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}`;
}

function getDurableScoreSessionId(
  userId: string,
  gameId: string,
  fingerprint: string,
): { id: string; storageKey: string } {
  const storageKey = `ykgame:score-submit:v1:${encodeURIComponent(userId)}:${gameId}`;
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(storageKey) ?? "null") as {
      id?: unknown;
      fingerprint?: unknown;
    } | null;
    if (
      stored &&
      typeof stored.id === "string" &&
      stored.fingerprint === fingerprint
    ) {
      return { id: stored.id, storageKey };
    }
    const id = window.crypto.randomUUID();
    window.sessionStorage.setItem(storageKey, JSON.stringify({ id, fingerprint }));
    return { id, storageKey };
  } catch {
    return { id: window.crypto.randomUUID(), storageKey };
  }
}

export function GameResultScreen({
  gameId,
  result,
  onRetry,
  onStay,
  onExit,
  onScoreSaved,
}: GameResultScreenProps) {
  const game = getGameById(gameId);
  const isYanmar = gameId === "yanmar";
  const isYanmarArcade = gameId === "yanmar" && typeof result.arcadeScore === "number";
  const stars = isYanmarArcade ? 0 : calculateStars(result.progress);
  const { data: session, update } = useSession();
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myTotalScore, setMyTotalScore] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const savedRef = useRef(false);
  const scoreSessionIdRef = useRef<string | null>(null);
  const updateRef = useRef(update);
  const onScoreSavedRef = useRef(onScoreSaved);

  useEffect(() => {
    updateRef.current = update;
  }, [update]);

  useEffect(() => {
    onScoreSavedRef.current = onScoreSaved;
  }, [onScoreSaved]);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (savedRef.current) return;
    savedRef.current = true;

    async function saveAndLoad() {
      try {
        if (gameId === "yanmar" && result.mode !== "game") {
          setSaved(true);
          return;
        }
        setSaveFailed(false);
        const scoreFingerprint = JSON.stringify({
          progress: result.progress,
          playTime: result.playTime,
          timeLeft: result.timeLeft,
          arcadeScore: result.arcadeScore,
          mode: result.mode,
        });
        const durableScoreSession = session?.user?.id
          ? getDurableScoreSessionId(
              session.user.id,
              gameId,
              scoreFingerprint,
            )
          : null;
        const scoreSessionId =
          scoreSessionIdRef.current ??
          durableScoreSession?.id ??
          window.crypto.randomUUID();
        scoreSessionIdRef.current = scoreSessionId;
        const saveRes = await fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameId,
            progress: result.progress,
            playTime: result.playTime,
            timeLeft: result.timeLeft,
            arcadeScore: result.arcadeScore,
            mode: result.mode,
            sessionId: scoreSessionId,
          }),
        });
        const saveData = await saveRes.json();
        if (!saveRes.ok) {
          throw new Error(saveData.error ?? "Failed to save score");
        }
        if (durableScoreSession) {
          try {
            window.sessionStorage.removeItem(durableScoreSession.storageKey);
          } catch {
            // The server already accepted the stable sessionId.
          }
        }

        if (gameId === "yanmar" && typeof result.arcadeScore === "number") {
          const userId = session?.user?.id;
          if (userId) {
            commitYanmarGameSessionScore(userId, result.arcadeScore);
          }
          onScoreSavedRef.current?.(result.arcadeScore);
        }
        setSaved(true);

        if (saveData.currency !== undefined) {
          await updateRef.current({ user: { currency: saveData.currency } });
        }

        try {
          const res = await fetch(`/api/rankings/${gameId}`);
          const data = await res.json();
          setRankings(data.rankings ?? []);
          setMyRank(data.myStats?.rank ?? null);
          setMyTotalScore(
            typeof data.myStats?.bestScore === "number"
              ? data.myStats.bestScore
              : null,
          );
        } catch {
          // 점수 저장은 완료됐으므로 랭킹 조회 실패로 재저장하지 않는다.
        }
      } catch {
        savedRef.current = false;
        setSaveFailed(true);
      }
    }
    void saveAndLoad();
  }, [
    gameId,
    result.arcadeScore,
    result.mode,
    result.progress,
    result.playTime,
    result.timeLeft,
    session?.user?.id,
  ]);

  const nickname = session?.user?.nickname ?? "";
  const isRide = result.mode === "ride";
  const title = isRide
    ? "탑승 체험 종료"
    : isYanmar
      ? "운행 결과"
      : result.completed
        ? "미션 완료!"
        : "시간 종료";
  const homeLabel = isRide ? "탑승 홈으로" : isYanmar ? "나가기" : "홈으로";
  const savePending = isYanmarArcade && !saved && !saveFailed;
  const yRankingRows = rankings.slice(0, 10);
  const yanmarDisplayScore =
    myTotalScore ?? result.arcadeScore ?? 0;
  const resultCard = (
    <div
      className="mx-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
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
          {isRide
            ? "탑승 체험 완료"
            : isYanmarArcade
              ? result.mode === "game"
                ? `누적 점수 ${yanmarDisplayScore.toLocaleString()}`
                : `연습 점수 ${(result.arcadeScore ?? 0).toLocaleString()}`
            : `${result.progress}%`}
        </p>
        <p className="text-sm text-gray-500">
          플레이 시간 {result.playTime}초
          {result.timeLeft > 0 ? ` · 남은 시간 ${result.timeLeft}초` : ""}
        </p>
        {!isYanmar && saved && stars > 0 && (
          <p className="mt-2 text-sm text-green-600">⭐ {stars}별 획득!</p>
        )}
        {result.mode === "game" && saved && myRank && (
          <p className="mt-1 text-sm text-blue-600">시즌 순위 #{myRank}</p>
        )}
        {isYanmar && result.mode === "practice" && (
          <p className="mt-2 text-xs text-gray-400">연습 운행 결과는 랭킹에 저장되지 않습니다.</p>
        )}
      </div>

      {!isYanmar || result.mode === "game" ? (
        <div className="mb-4 rounded-xl bg-gray-50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700">
            {isYanmar ? "누적 점수 Top 10" : "이번 달 Top 10"}
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
                  {yanmarDisplayScore.toLocaleString()}점
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
                    <span className="shrink-0 font-semibold">{r.score.toLocaleString()}점</span>
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
      ) : null}

      <div className="flex gap-2">
        {isYanmar && onStay ? (
          <button
            onClick={onStay}
            disabled={savePending}
            className="flex-1 rounded-lg bg-gray-200 py-3 text-center font-medium text-gray-700 hover:bg-gray-300 disabled:cursor-wait disabled:opacity-50"
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
            disabled={savePending}
            className="flex-1 rounded-lg py-3 text-center font-medium text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-50"
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
        <p className={`mt-2 text-center text-xs ${saveFailed ? "text-red-500" : "text-gray-400"}`}>
          {saveFailed ? "점수를 저장하지 못했습니다. 나중에 다시 시도해 주세요." : "점수 저장 중..."}
        </p>
      )}
    </div>
  );

  if (isYanmar) {
    if (typeof document === "undefined") return null;

    return createPortal(
      <>
        <div
          className="fixed inset-0 z-[320] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]"
          onClick={onStay}
        >
          {resultCard}
        </div>

        <RankingBoard
          gameId={gameId}
          open={showRanking}
          onClose={() => setShowRanking(false)}
          highlightNickname={nickname}
        />
      </>,
      document.body,
    );
  }

  return (
    <>
      {resultCard}

      <RankingBoard
        gameId={gameId}
        open={showRanking}
        onClose={() => setShowRanking(false)}
        highlightNickname={nickname}
      />
    </>
  );
}
