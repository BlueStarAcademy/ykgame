"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { GameCardSprite } from "@/components/home/GameCardSprite";
import { PhaserGameWrapper } from "@/components/games/PhaserGameWrapper";
import { GameImmersiveOverlay } from "@/components/games/GameImmersiveOverlay";
import { RankingBoard, RankingBoardPanel } from "@/components/games/RankingBoard";
import type { GameConfig, GameId } from "@/lib/games";
import { getGameById } from "@/lib/games";
import { prepareInGameFullscreen } from "@/lib/fullscreen";
import { enablePwaMode } from "@/lib/pwa-mode";
import type { GameResult } from "@/games/shared/types";
import { YANMAR_REWARD_CONFIG } from "@/games/yanmar/equipment";
import { GameResultScreen } from "./GameResultScreen";

/** 모드 버튼 클릭(사용자 제스처)에서 전체화면 + 세로 고정 후 인게임 진입 */
async function enterPlayingAfterGesture(
  start: () => void,
): Promise<void> {
  enablePwaMode();
  await prepareInGameFullscreen();
  start();
}

interface GamePlayClientProps {
  gameId: GameId;
}

interface MyStats {
  rank: number | null;
  bestScore: number;
  bestStars: number;
}

type GamePhase = "lobby" | "playing" | "result";
type PlayMode = "practice" | "game" | "ride";

function controlLabel(type: string) {
  if (type === "excavator") return "듀얼 조이스틱";
  if (type === "dpad") return "D-pad 조작";
  if (type === "steering") return "조향 휠 조작";
  return "버튼 조작";
}

function formatDuration(seconds: number) {
  if (seconds <= 0) return "무제한";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}분 ${s > 0 ? `${s}초` : ""}`;
}

const YANMAR_LOBBY_TITLE = "굴착 하역 챌린지";

const YANMAR_STEPS = [
  { icon: "🟠", title: "굴착", desc: "주황 구역에서 흙 적재" },
  { icon: "🚛", title: "하역", desc: "덤프트럭에 토사 투하" },
  { icon: "🎁", title: "보상", desc: "하역 시 랜덤으로 보상 획득" },
  { icon: "🔨", title: "강화", desc: "스타로 굴착기·트럭 업그레이드" },
];

const YANMAR_REWARDS = [
  {
    icon: "⭐",
    label: "스타",
    desc: `${YANMAR_REWARD_CONFIG.minStarReward}~${YANMAR_REWARD_CONFIG.maxStarReward}개 랜덤`,
  },
  { icon: "🎟️", label: "YK 부품 할인권", desc: "10 / 15 / 20%" },
  { icon: "🎟️", label: "장비 대여 할인권", desc: "10 / 20 / 30%" },
];

type YanmarLobbyTab = "guide" | "rewards" | "ranking";

function YanmarGuideLobby({
  game,
  highlightNickname,
  onStartPractice,
  onStartGame,
}: {
  game: GameConfig;
  highlightNickname: string;
  onStartPractice: () => void;
  onStartGame: () => void;
}) {
  const [activeTab, setActiveTab] = useState<YanmarLobbyTab>("guide");

  const tabs: { id: YanmarLobbyTab; label: string }[] = [
    { id: "guide", label: "게임방법" },
    { id: "rewards", label: "보상" },
    { id: "ranking", label: "랭킹" },
  ];

  return (
    <div className="game-lobby-shell game-lobby-shell-tabbed">
      <div
        className="game-lobby-hero shrink-0"
        style={{
          background: `linear-gradient(145deg, ${game.color} 0%, ${game.headerColor} 45%, #1a0a0a 100%)`,
        }}
      >
        <div className="game-lobby-hero-inner">
          <div className="game-lobby-hero-copy">
            <p className="game-lobby-brand">{game.brandEn}</p>
            <h2 className="game-lobby-title">{YANMAR_LOBBY_TITLE}</h2>
          </div>
          <div className="game-lobby-hero-art" aria-hidden>
            <GameCardSprite gameId={game.id} />
          </div>
        </div>

        <div className="game-lobby-tabs" role="tablist" aria-label="로비 정보">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`game-lobby-tab ${activeTab === tab.id ? "game-lobby-tab-active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="game-lobby-body game-lobby-body-scroll game-lobby-body-fixed">
        <div className="game-lobby-tab-panel">
          {activeTab === "guide" ? (
            <section className="game-lobby-section game-lobby-section-fill">
              <div className="game-lobby-guide-grid">
                {YANMAR_STEPS.map((step) => (
                  <div key={step.title} className="game-lobby-guide-card">
                    <p className="game-lobby-guide-card-title">
                      {step.icon} {step.title}
                    </p>
                    <p className="game-lobby-guide-card-desc">{step.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === "rewards" ? (
            <section className="game-lobby-section game-lobby-section-fill">
              <div className="game-lobby-reward-grid">
                {YANMAR_REWARDS.map((reward) => (
                  <div key={reward.label} className="game-lobby-reward-card">
                    <p className="game-lobby-reward-label">
                      {reward.icon} {reward.label}
                    </p>
                    <p className="game-lobby-reward-desc">{reward.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === "ranking" ? (
            <section className="game-lobby-section game-lobby-section-fill">
              <RankingBoardPanel
                gameId="yanmar"
                highlightNickname={highlightNickname}
                active={activeTab === "ranking"}
                embedded
              />
            </section>
          ) : null}
        </div>
      </div>

      <div className="game-lobby-footer">
        <div className="game-lobby-mode-grid">
          <button
            type="button"
            onClick={onStartPractice}
            className="game-lobby-mode game-lobby-mode-card game-lobby-mode-practice"
          >
            <span className="game-lobby-mode-icon game-lobby-mode-icon-practice">🎓</span>
            <span className="game-lobby-mode-card-copy">
              <span className="game-lobby-mode-copy-title">연습모드</span>
              <span className="game-lobby-mode-copy-desc">점수/보상/랭킹 없음</span>
            </span>
          </button>

          <button
            type="button"
            onClick={onStartGame}
            className="game-lobby-mode game-lobby-mode-card game-lobby-mode-game"
          >
            <span
              className="game-lobby-mode-icon"
              style={{
                background: `linear-gradient(145deg, ${game.color} 0%, ${game.headerColor} 100%)`,
              }}
            >
              🏆
            </span>
            <span className="game-lobby-mode-card-copy">
              <span className="game-lobby-mode-copy-title">게임모드</span>
              <span className="game-lobby-mode-copy-desc">점수 · 보상 도전</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function DefaultGameLobby({
  game,
  myStats,
  onStart,
  onShowRanking,
}: {
  game: GameConfig;
  myStats: MyStats;
  onStart: () => void;
  onShowRanking: () => void;
}) {
  return (
    <div className="game-guide-card overflow-hidden rounded-2xl border border-slate-200/80">
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
          <p className="mt-1 text-sm leading-relaxed text-gray-600">{game.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gray-50 p-3 text-center">
            <p className="text-xs text-gray-500">제한 시간</p>
            <p className="text-sm font-bold text-gray-800">⏱ {formatDuration(game.duration)}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 text-center">
            <p className="text-xs text-gray-500">조작 방식</p>
            <p className="text-sm font-bold text-gray-800">{controlLabel(game.controlType)}</p>
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
            type="button"
            onClick={onShowRanking}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            📊 랭킹보드
          </button>
          <button
            type="button"
            onClick={onStart}
            className="flex-[2] rounded-xl py-3 text-sm font-bold text-white shadow-md hover:opacity-90"
            style={{ backgroundColor: game.color }}
          >
            ▶ 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}

export function GamePlayClient({
  gameId,
  initialPlay,
  standalone = false,
}: GamePlayClientProps & {
  initialPlay?: "ride";
  standalone?: boolean;
}) {
  const game = getGameById(gameId);
  const router = useRouter();
  const { data: session } = useSession();
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [playMode, setPlayMode] = useState<PlayMode | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [yanmarExitSignal, setYanmarExitSignal] = useState(0);
  const [yanmarResumeSignal, setYanmarResumeSignal] = useState(0);
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

  useEffect(() => {
    if (gameId === "yanmar" && initialPlay === "ride") {
      setResult(null);
      setPlayMode("ride");
      setYanmarExitSignal(0);
      setPhase("playing");
    }
  }, [gameId, initialPlay]);

  const handleStartPractice = () => {
    void enterPlayingAfterGesture(() => {
      setResult(null);
      setPlayMode("practice");
      setYanmarExitSignal(0);
      setPhase("playing");
    });
  };

  const handleStartGame = () => {
    void enterPlayingAfterGesture(() => {
      setResult(null);
      setPlayMode("game");
      setYanmarExitSignal(0);
      setPhase("playing");
    });
  };

  const handleStart = () => {
    void enterPlayingAfterGesture(() => {
      setResult(null);
      setPlayMode(null);
      setYanmarExitSignal(0);
      setPhase("playing");
    });
  };

  const handleExitGame = () => {
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
  };

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
    loadStats();
  };

  const handleStay = () => {
    setResult(null);
    setYanmarResumeSignal((value) => value + 1);
    loadStats();
  };

  const handleExitHome = () => {
    router.push(playMode === "ride" || initialPlay === "ride" ? "/ride" : "/home");
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
      {phase === "lobby" && gameId === "yanmar" ? (
        <div className="game-lobby-page flex min-h-0 flex-1 flex-col overflow-hidden">
          {!standalone ? (
            <Link href="/home" className="game-page-back shrink-0">
              <span aria-hidden>←</span> 홈으로
            </Link>
          ) : null}
          <YanmarGuideLobby
            game={game}
            highlightNickname={nickname}
            onStartPractice={handleStartPractice}
            onStartGame={handleStartGame}
          />
        </div>
      ) : (
        <>
          {!standalone ? (
            <Link href="/home" className="game-page-back">
              <span aria-hidden>←</span> 홈으로
            </Link>
          ) : null}

          {phase === "lobby" ? (
            <DefaultGameLobby
              game={game}
              myStats={myStats}
              onStart={handleStart}
              onShowRanking={() => setShowRanking(true)}
            />
          ) : null}
        </>
      )}

      {phase === "playing" && (
        <GameImmersiveOverlay
          active
          headerColor={game.headerColor}
          onExit={handleExitGame}
          onShowRanking={() => setShowRanking(true)}
          myRank={myStats.rank}
          bestScore={myStats.bestScore}
          hideHeaderStats={gameId === "yanmar"}
          hideRankingButton={gameId === "yanmar"}
          showPracticeTicker={playMode === "practice"}
        >
          <PhaserGameWrapper
            gameId={gameId}
            onEnd={handleGameEnd}
            exitSignal={yanmarExitSignal}
            resumeSignal={yanmarResumeSignal}
            immersive
            initialPlayMode={playMode ?? undefined}
            onShowRanking={() => setShowRanking(true)}
            myRank={myStats.rank}
            bestScore={myStats.bestScore}
          />
        </GameImmersiveOverlay>
      )}

      {gameId === "yanmar" && phase === "playing" && result && (
        <GameResultScreen
          gameId={gameId}
          result={result}
          onStay={handleStay}
          onExit={handleExitHome}
        />
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
