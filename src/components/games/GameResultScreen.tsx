"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import type { GameId } from "@/lib/games";
import { getGameById, calculateStars } from "@/lib/games";
import type { GameResult } from "@/games/shared/types";
import { commitYanmarGameSessionScore } from "@/games/yanmar/gameSessionPersistence";
import { useRegisterInGameBackDismiss } from "@/hooks/useInGameBackNavigation";
import { RankingBoard } from "./RankingBoard";
import { RankBadge } from "./RankBadge";

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
  /** Prior season total (HUD uses seasonScoreBase + session arcadeScore). */
  seasonScoreBase?: number;
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
  seasonScoreBase = 0,
}: GameResultScreenProps) {
  const t = useTranslations("games.results");
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

  useRegisterInGameBackDismiss(Boolean(onExit), onExit);

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
    ? t("rideTitle")
    : isYanmar
      ? t("yanmarTitle")
      : result.completed
        ? t("completedTitle")
        : t("timeOverTitle");
  const homeLabel = isRide ? t("rideHome") : isYanmar ? t("exit") : t("home");
  const savePending = isYanmarArcade && !saved && !saveFailed;
  const yRankingRows = rankings.slice(0, 10);
  const sessionArcadeScore = result.arcadeScore ?? 0;
  const projectedSeasonTotal = Math.max(
    0,
    seasonScoreBase + sessionArcadeScore,
  );
  // Prefer the projected total so the modal matches the in-game HUD from frame 1.
  // Rankings may refine it after save, but never flash the raw session-only score.
  const yanmarDisplayScore =
    typeof myTotalScore === "number" ? myTotalScore : projectedSeasonTotal;
  const accent = game?.color ?? "#E53935";
  const accentDeep = game?.headerColor ?? "#C62828";

  const actionButtons = (
    <div className="flex gap-2">
      {isYanmar && onStay ? (
        <button
          type="button"
          onClick={onStay}
          disabled={savePending}
          className="flex-1 rounded-xl border border-white/10 bg-white/10 py-3 text-center text-sm font-bold text-white hover:bg-white/15 disabled:cursor-wait disabled:opacity-50"
        >
          {t("stay")}
        </button>
      ) : onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 rounded-lg bg-gray-200 py-3 text-center font-medium text-gray-700 hover:bg-gray-300"
        >
          {t("retry")}
        </button>
      ) : (
        <Link
          href={isYanmar ? "/home" : `/games/${gameId}`}
          className="flex-1 rounded-lg bg-gray-200 py-3 text-center font-medium text-gray-700 hover:bg-gray-300"
        >
          {t("retry")}
        </Link>
      )}
      {onExit ? (
        <button
          type="button"
          onClick={onExit}
          disabled={savePending}
          className="flex-1 rounded-xl py-3 text-center text-sm font-bold text-white shadow-lg hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
          style={{ backgroundColor: accent }}
        >
          {homeLabel}
        </button>
      ) : (
        <Link
          href={isRide ? "/ride" : "/home"}
          className="flex-1 rounded-xl py-3 text-center text-sm font-bold text-white shadow-lg hover:brightness-110"
          style={{ backgroundColor: accent }}
        >
          {homeLabel}
        </Link>
      )}
    </div>
  );

  const saveStatus = !saved ? (
    <p
      className={`mt-2 text-center text-[11px] font-semibold ${
        saveFailed ? "text-red-300" : "text-white/45"
      }`}
    >
      {saveFailed
        ? t("saveFailed")
        : t("saving")}
    </p>
  ) : null;

  /** Fixed-size in-game result modal (save & exit). */
  const yanmarResultModal = (
    <div
      className="flex h-[min(34rem,calc(100dvh-2rem))] w-[min(22rem,calc(100vw-2rem))] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#121820] shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="yanmar-result-title"
    >
      <header
        className="relative shrink-0 px-5 pb-4 pt-5 text-center"
        style={{
          background: `linear-gradient(180deg, ${accentDeep} 0%, #121820 100%)`,
        }}
      >
        <p className="text-[10px] font-bold tracking-[0.18em] text-white/55 uppercase">
          {game?.brandEn ?? "SITE LEGEND"}
        </p>
        <h2
          id="yanmar-result-title"
          className="mt-1 text-xl font-black tracking-tight text-white"
        >
          {title}
        </h2>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-1">
        <div className="shrink-0 rounded-xl border border-white/8 bg-white/[0.04] px-4 py-4 text-center">
          <p className="text-[11px] font-semibold text-white/50">
            {isRide
              ? t("rideExperience")
              : result.mode === "game"
                ? t("cumulativeScore")
                : t("practiceScore")}
          </p>
          <p className="mt-1 text-[2rem] font-black leading-none tabular-nums tracking-tight text-white">
            {isRide
              ? t("complete")
              : result.mode === "game"
                ? yanmarDisplayScore.toLocaleString()
                : (result.arcadeScore ?? 0).toLocaleString()}
          </p>
          <p className="mt-2 text-[11px] font-medium text-white/45">
            {t("playTime", { seconds: result.playTime })}
            {result.timeLeft > 0 ? ` · ${t("timeRemaining", { seconds: result.timeLeft })}` : ""}
            {result.mode === "game" && sessionArcadeScore > 0
              ? ` · ${t("thisRunScore", { score: sessionArcadeScore.toLocaleString() })}`
              : ""}
            {result.mode === "game" && myRank ? ` · ${t("seasonRank", { rank: myRank })}` : ""}
          </p>
          {result.mode === "practice" ? (
            <p className="mt-2 text-[10px] font-medium text-white/35">
              {t("practiceNotRanked")}
            </p>
          ) : null}
        </div>

        {result.mode === "game" ? (
          <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/8 bg-black/25">
            <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-3 py-2">
              <h3 className="text-[11px] font-bold text-white/70">{t("cumulativeTop10")}</h3>
              <span className="text-[10px] font-semibold text-white/40">{t("season")}</span>
            </div>

            <div
              className="mx-2 mt-2 shrink-0 rounded-lg px-3 py-2"
              style={{ backgroundColor: `${accent}22`, border: `1px solid ${accent}55` }}
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-bold text-white">
                  {t("myRank", { rank: myRank ? `#${myRank}` : "—" })}
                </span>
                <span className="shrink-0 font-black tabular-nums text-white">
                  {t("points", { score: yanmarDisplayScore.toLocaleString() })}
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 [-webkit-overflow-scrolling:touch]">
              {yRankingRows.length === 0 ? (
                <p className="px-2 py-6 text-center text-[11px] text-white/35">
                  {savePending ? t("rankingLoading") : t("noRankingData")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {yRankingRows.map((r) => {
                    const isMe = r.rank === myRank;
                    return (
                      <li
                        key={r.rank}
                        className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-[12px] ${
                          isMe
                            ? "bg-white/12 font-bold text-white"
                            : "text-white/75"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2 truncate">
                          <RankBadge rank={r.rank} size="sm" tone="dark" />
                          <span className="truncate">{r.nickname}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-white/90">
                          {r.score.toLocaleString()}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3 min-h-0 flex-1" />
        )}

        <div className="mt-3 shrink-0">
          {actionButtons}
          {saveStatus}
        </div>
      </div>
    </div>
  );

  const resultCard = (
    <div
      className="mx-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <h2 className="text-center text-xl font-bold" style={{ color: accent }}>
        {title}
      </h2>
      <p className="mt-1 text-center text-sm text-gray-500">{game?.brandEn}</p>

      <div className="my-6 text-center">
        <p className="text-4xl text-yellow-400">
          {"★".repeat(stars)}
          {"☆".repeat(3 - stars)}
        </p>
        <p className="mt-2 text-2xl font-bold text-gray-800">{result.progress}%</p>
        <p className="text-sm text-gray-500">
          {t("playTime", { seconds: result.playTime })}
          {result.timeLeft > 0 ? ` · ${t("timeRemaining", { seconds: result.timeLeft })}` : ""}
        </p>
        {saved && stars > 0 && (
          <p className="mt-2 text-sm text-green-600">⭐ {t("starsEarned", { stars })}</p>
        )}
        {result.mode === "game" && saved && myRank && (
          <p className="mt-1 text-sm text-blue-600">{t("seasonRank", { rank: myRank })}</p>
        )}
      </div>

      <div className="mb-4 rounded-xl bg-gray-50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700">{t("monthlyTop10")}</h3>
          <button
            type="button"
            onClick={() => setShowRanking(true)}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            {t("viewAll")}
          </button>
        </div>
        {rankings.length === 0 ? (
          <p className="text-xs text-gray-400">{t("noRankingData")}</p>
        ) : (
          <ul className="space-y-1">
            {rankings.slice(0, 5).map((r) => (
              <li key={r.rank} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 truncate">
                  <RankBadge rank={r.rank} size="sm" tone="light" />
                  <span className="truncate">{r.nickname}</span>
                </span>
                <span className="shrink-0 text-gray-600">{t("points", { score: r.score })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 rounded-lg bg-gray-200 py-3 text-center font-medium text-gray-700 hover:bg-gray-300"
          >
            {t("retry")}
          </button>
        ) : (
          <Link
            href={`/games/${gameId}`}
            className="flex-1 rounded-lg bg-gray-200 py-3 text-center font-medium text-gray-700 hover:bg-gray-300"
          >
            {t("retry")}
          </Link>
        )}
        {onExit ? (
          <button
            type="button"
            onClick={onExit}
            className="flex-1 rounded-lg py-3 text-center font-medium text-white hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            {homeLabel}
          </button>
        ) : (
          <Link
            href="/home"
            className="flex-1 rounded-lg py-3 text-center font-medium text-white hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            {homeLabel}
          </Link>
        )}
      </div>
      {!saved && (
        <p className={`mt-2 text-center text-xs ${saveFailed ? "text-red-500" : "text-gray-400"}`}>
          {saveFailed ? t("saveFailed") : t("saving")}
        </p>
      )}
    </div>
  );

  if (isYanmar) {
    if (typeof document === "undefined") return null;

    return createPortal(
      <>
        <div
          className="fixed inset-0 z-[320] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[3px]"
          onClick={onStay}
        >
          {yanmarResultModal}
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
