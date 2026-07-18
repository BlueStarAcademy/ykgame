"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { SiteLegendHomeScreen } from "@/components/home/SiteLegendHomeScreen";
import { GameImmersiveOverlay } from "@/components/games/GameImmersiveOverlay";
import { RankingBoard } from "@/components/games/RankingBoard";
import type { GameId } from "@/lib/games";
import { getGameById, isGameAvailable } from "@/lib/games";
import { exitFullscreen, prepareInGameFullscreen } from "@/lib/fullscreen";
import { enablePwaMode } from "@/lib/pwa-mode";
import { markResumeInGame, shouldResumeInGame } from "@/lib/resumeInGame";
import type { GameResult } from "@/games/shared/types";
import { YanmarGuideModal } from "@/games/yanmar/YanmarInfoModals";
import { InGameBackProvider } from "@/hooks/useInGameBackNavigation";
import { GameResultScreen } from "./GameResultScreen";

const PhaserGameWrapper = dynamic(
  () =>
    import("@/components/games/PhaserGameWrapper").then((mod) => mod.PhaserGameWrapper),
  { ssr: false },
);

/** 인게임 텍스처를 R3F 캐시에 미리 올려 Suspense 대기 시간을 줄인다 (논블로킹). */
function preloadYanmarSceneAssets(): void {
  void Promise.all([
    import("three"),
    import("@react-three/fiber"),
    import("@/games/yanmar/siteTextures"),
    import("@/lib/brand-assets"),
  ])
    .then(([THREE, { useLoader }, { PREMIUM_SITE_TEXTURES }, { YK_GEONGI_LOGO }]) => {
      const urls = [
        ...Object.values(PREMIUM_SITE_TEXTURES),
        YK_GEONGI_LOGO.white,
        YK_GEONGI_LOGO.black,
        "/images/yanmar/yanmar-logo-white.png",
      ];
      useLoader.preload(THREE.TextureLoader, urls);
    })
    .catch(() => undefined);
}

/** 사용자 제스처에서 전체화면만 건다. 에셋/청크는 마운트와 병렬로 진행. */
async function prepareGameEntry(): Promise<void> {
  enablePwaMode();
  // Warm the dynamic import + texture cache without blocking mount.
  void import("@/components/games/PhaserGameWrapper");
  preloadYanmarSceneAssets();
  await prepareInGameFullscreen();
}

export interface LobbyProfileProps {
  totalXp: number;
  seasonLabel: string;
  rank: number | null;
  seasonScore: number;
  highlightGameName?: string | null;
}

interface GamePlayClientProps {
  gameId: GameId;
  lobbyProfile?: LobbyProfileProps;
}

interface MyStats {
  rank: number | null;
  bestScore: number;
  bestStars: number;
}

type GamePhase = "lobby" | "playing" | "result";
type PlayMode = "practice" | "game" | "ride";

export function GamePlayClient({
  gameId,
  initialPlay,
  lobbyProfile,
}: GamePlayClientProps & {
  initialPlay?: "ride";
  standalone?: boolean;
}) {
  const game = getGameById(gameId);
  const router = useRouter();
  const { data: session } = useSession();
  const playable = isGameAvailable(gameId);
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [playMode, setPlayMode] = useState<PlayMode | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [yanmarExitSignal, setYanmarExitSignal] = useState(0);
  const [yanmarResumeSignal, setYanmarResumeSignal] = useState(0);
  const [yanmarScoreCommit, setYanmarScoreCommit] = useState<{
    id: number;
    score: number;
  } | null>(null);
  /** DB에 반영된 시즌 점수. HUD에서는 아직 저장하지 않은 세션 점수만 더한다. */
  const [yanmarSeasonBaseScore, setYanmarSeasonBaseScore] = useState(0);
  const [myStats, setMyStats] = useState<MyStats>({
    rank: lobbyProfile?.rank ?? null,
    bestScore: lobbyProfile?.seasonScore ?? 0,
    bestStars: 0,
  });
  const [showRanking, setShowRanking] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [entryLoading, setEntryLoading] = useState(false);
  const entryRevealRafRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (!entryLoading) return;
    const timeout = window.setTimeout(() => {
      setEntryLoading(false);
    }, 12000);
    return () => window.clearTimeout(timeout);
  }, [entryLoading]);

  useEffect(() => {
    return () => {
      if (entryRevealRafRef.current != null) {
        window.cancelAnimationFrame(entryRevealRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (gameId === "yanmar" && initialPlay === "ride" && playable) {
      setResult(null);
      setPlayMode("ride");
      setYanmarExitSignal(0);
      setPhase("playing");
    }
  }, [gameId, initialPlay, playable]);

  /** 홈 화면 「게임 시작」은 항상 게임모드로만 진입한다. */
  const startInFlightRef = useRef(false);
  const handleStartGame = useCallback(() => {
    if (!playable || startInFlightRef.current) return;
    startInFlightRef.current = true;
    if (entryRevealRafRef.current != null) {
      window.cancelAnimationFrame(entryRevealRafRef.current);
      entryRevealRafRef.current = null;
    }
    setEntryLoading(true);
    void (async () => {
      try {
        // Fullscreen must stay in the click gesture; everything else loads under the splash.
        await prepareGameEntry();
      } catch {
        // 전체화면 실패해도 인게임 진입은 진행
      }
      void loadStats();
      setResult(null);
      setPlayMode("game");
      setYanmarSeasonBaseScore(myStats.bestScore);
      setYanmarExitSignal(0);
      setPhase("playing");
    })();
  }, [loadStats, myStats.bestScore, playable]);

  /** 관리자 페이지에서 돌아오면 저장해 둔 세션으로 인게임 재진입. */
  useEffect(() => {
    if (!playable || gameId !== "yanmar" || initialPlay === "ride") return;

    const params = new URLSearchParams(window.location.search);
    const resumeQuery = params.get("resume") === "1";
    if (resumeQuery) {
      markResumeInGame();
      window.history.replaceState({}, "", "/home");
    }
    if (!resumeQuery && !shouldResumeInGame()) return;

    handleStartGame();
  }, [gameId, handleStartGame, initialPlay, playable]);

  const handleGameReady = useCallback(() => {
    // Hard-cut once the canvas has been painted under the opaque splash.
    if (entryRevealRafRef.current != null) {
      window.cancelAnimationFrame(entryRevealRafRef.current);
    }
    entryRevealRafRef.current = window.requestAnimationFrame(() => {
      entryRevealRafRef.current = null;
      setEntryLoading(false);
    });
  }, []);

  const resolvedPlayMode: PlayMode =
    initialPlay === "ride" || playMode === "ride" ? "ride" : "game";

  const handleExitGame = useCallback(() => {
    if (gameId === "yanmar" && (playMode === "ride" || initialPlay === "ride")) {
      router.push("/ride");
      return;
    }
    if (gameId === "yanmar") {
      setYanmarExitSignal((value) => value + 1);
      return;
    }
    setPlayMode(null);
    setPhase("lobby");
  }, [gameId, initialPlay, playMode, router]);

  /** 「게임 저장 후 종료」와 동일: 전체화면 해제 후 세션 저장·결과 화면 */
  const handleSaveAndExitLikeButton = useCallback((): boolean | void => {
    void exitFullscreen();
    if (gameId === "yanmar" && (playMode === "ride" || initialPlay === "ride")) {
      router.push("/ride");
      return false;
    }
    handleExitGame();
  }, [gameId, handleExitGame, initialPlay, playMode, router]);

  const handleGameEnd = (gameResult: GameResult) => {
    setResult(gameResult);
    if (gameId === "yanmar") {
      loadStats();
      return;
    }
    setPhase("result");
  };

  const handleRetry = () => {
    setResult(null);
    setPlayMode(null);
    setPhase("lobby");
    setEntryLoading(false);
    loadStats();
  };

  const handleStay = () => {
    setResult(null);
    setYanmarResumeSignal((value) => value + 1);
    loadStats();
  };

  const handleYanmarScoreSaved = useCallback(
    (score: number) => {
      setYanmarSeasonBaseScore((total) => total + score);
      setYanmarScoreCommit((commit) => ({
        id: (commit?.id ?? 0) + 1,
        score,
      }));
      void loadStats();
    },
    [loadStats],
  );

  const handleExitHome = () => {
    if (playMode === "ride" || initialPlay === "ride") {
      router.push("/ride");
      return;
    }
    // 게임체험은 이미 /home 로비이므로 동일 경로 push 대신 로비 상태로 복귀
    setResult(null);
    setPlayMode(null);
    setPhase("lobby");
    setEntryLoading(false);
    setYanmarExitSignal(0);
    void loadStats();
  };

  if (!game) return null;

  const displayNickname = session?.user?.nickname ?? "";
  const showHome = phase === "lobby" || entryLoading;

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
    <InGameBackProvider
      active={phase === "playing" && playable}
      onEmptyBack={handleSaveAndExitLikeButton}
    >
      {showHome ? (
        <div
          className={
            entryLoading ? "site-legend-entry-overlay" : undefined
          }
        >
          <SiteLegendHomeScreen
            nickname={displayNickname}
            role={session?.user?.role}
            onStartGame={handleStartGame}
            isEnteringGame={entryLoading}
          />
        </div>
      ) : null}

      {phase === "playing" && playable ? (
        <GameImmersiveOverlay
          active
          headerColor={game.headerColor}
          onExit={handleExitGame}
          onShowRanking={() => setShowRanking(true)}
          myRank={myStats.rank}
          bestScore={myStats.bestScore}
          hideHeaderStats={gameId === "yanmar"}
          hideExitButton={gameId === "yanmar"}
          hideRankingButton={gameId === "yanmar"}
          hideFullscreenButton={gameId === "yanmar"}
          showPracticeTicker={false}
        >
          <PhaserGameWrapper
            gameId={gameId}
            onEnd={handleGameEnd}
            exitSignal={yanmarExitSignal}
            resumeSignal={yanmarResumeSignal}
            scoreCommit={yanmarScoreCommit}
            immersive
            initialPlayMode={resolvedPlayMode}
            onShowGuide={() => setShowGuide(true)}
            onShowRanking={() => setShowRanking(true)}
            onRequestExit={handleExitGame}
            seasonScoreBase={yanmarSeasonBaseScore}
            onReady={handleGameReady}
          />
        </GameImmersiveOverlay>
      ) : null}

      {gameId === "yanmar" && phase === "playing" && result ? (
        <GameResultScreen
          gameId={gameId}
          result={result}
          onStay={handleStay}
          onExit={handleExitHome}
          onScoreSaved={handleYanmarScoreSaved}
        />
      ) : null}

      <YanmarGuideModal open={showGuide} onClose={() => setShowGuide(false)} />
      <RankingBoard
        gameId={gameId}
        open={showRanking}
        onClose={() => setShowRanking(false)}
        highlightNickname={displayNickname}
      />
    </InGameBackProvider>
  );
}
