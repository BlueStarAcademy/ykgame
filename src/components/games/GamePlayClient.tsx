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
import { getGameById, isGameAvailable } from "@/lib/games";
import { BRAND_PROFILES } from "@/lib/landing-content";
import { prepareInGameFullscreen } from "@/lib/fullscreen";
import { enablePwaMode } from "@/lib/pwa-mode";
import type { GameResult } from "@/games/shared/types";
import { YANMAR_REWARD_CONFIG } from "@/games/yanmar/equipment";
import { GameResultScreen } from "./GameResultScreen";

/** 모드 버튼 클릭(사용자 제스처)에서 전체화면 + 세로 고정 후 인게임 진입 */
async function enterPlayingAfterGesture(start: () => void): Promise<void> {
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
type LobbyTab = "guide" | "rewards" | "ranking";

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
  {
    icon: "🎟️",
    label: "필터 세트 교환 쿠폰",
    desc: `시즌 ${YANMAR_REWARD_CONFIG.filterSetCouponSeasonLimit}장`,
  },
];

const DEFAULT_REWARDS = [
  { icon: "⭐", label: "스타", desc: "미션 완료 시 획득" },
  { icon: "🎟️", label: "쿠폰", desc: "랜덤 할인 보상" },
  { icon: "🏆", label: "랭킹", desc: "시즌 기록 경쟁" },
];

function BrandGuideLobby({
  game,
  highlightNickname,
  playable,
  onStartPractice,
  onStartGame,
}: {
  game: GameConfig;
  highlightNickname: string;
  playable: boolean;
  onStartPractice: () => void;
  onStartGame: () => void;
}) {
  const [activeTab, setActiveTab] = useState<LobbyTab>("guide");
  const profile = BRAND_PROFILES[game.id];
  const isYanmar = game.id === "yanmar";
  const title = isYanmar ? YANMAR_LOBBY_TITLE : game.mission;
  const steps = isYanmar
    ? YANMAR_STEPS
    : [
        { icon: "🎯", title: "미션", desc: game.mission },
        { icon: "🕹️", title: "조작", desc: profile.category },
        { icon: "✨", title: "포인트", desc: profile.highlight },
        { icon: "📖", title: "소개", desc: profile.description },
      ];
  const rewards = isYanmar ? YANMAR_REWARDS : DEFAULT_REWARDS;

  const tabs: { id: LobbyTab; label: string }[] = [
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
            <h2 className="game-lobby-title">{title}</h2>
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
                {steps.map((step) => (
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
                {rewards.map((reward) => (
                  <div key={reward.label} className="game-lobby-reward-card">
                    <span className="game-lobby-reward-label">
                      <span aria-hidden>{reward.icon}</span>
                      {reward.label}
                    </span>
                    <span className="game-lobby-reward-desc">{reward.desc}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === "ranking" ? (
            <section className="game-lobby-section game-lobby-section-fill">
              <RankingBoardPanel
                gameId={game.id}
                highlightNickname={highlightNickname}
                active={activeTab === "ranking"}
                embedded
              />
            </section>
          ) : null}
        </div>
      </div>

      <div className="game-lobby-footer">
        {!playable ? (
          <p className="game-lobby-mode-locked-note">
            이 장비의 연습·게임 모드는 준비 중입니다
          </p>
        ) : null}
        <div className="game-lobby-mode-grid">
          <button
            type="button"
            onClick={onStartPractice}
            disabled={!playable}
            className={`game-lobby-mode game-lobby-mode-card game-lobby-mode-practice${
              playable ? "" : " is-locked"
            }`}
          >
            <span className="game-lobby-mode-icon game-lobby-mode-icon-practice">🎓</span>
            <span className="game-lobby-mode-card-copy">
              <span className="game-lobby-mode-copy-title">연습모드</span>
              <span className="game-lobby-mode-copy-desc">
                {playable ? "점수/보상/랭킹 없음" : "준비 중"}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onStartGame}
            disabled={!playable}
            className={`game-lobby-mode game-lobby-mode-card game-lobby-mode-game${
              playable ? "" : " is-locked"
            }`}
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
              <span className="game-lobby-mode-copy-desc">
                {playable ? "점수 · 보상 도전" : "준비 중"}
              </span>
            </span>
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
  const playable = isGameAvailable(gameId);
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
    if (gameId === "yanmar" && initialPlay === "ride" && playable) {
      setResult(null);
      setPlayMode("ride");
      setYanmarExitSignal(0);
      setPhase("playing");
    }
  }, [gameId, initialPlay, playable]);

  const handleStartPractice = () => {
    if (!playable) return;
    void enterPlayingAfterGesture(() => {
      setResult(null);
      setPlayMode("practice");
      setYanmarExitSignal(0);
      setPhase("playing");
    });
  };

  const handleStartGame = () => {
    if (!playable) return;
    void enterPlayingAfterGesture(() => {
      setResult(null);
      setPlayMode("game");
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
      {phase === "lobby" ? (
        <div className="game-lobby-page flex min-h-0 flex-1 flex-col overflow-hidden">
          {!standalone ? (
            <Link href="/home" className="game-page-back shrink-0">
              <span aria-hidden>←</span> 홈으로
            </Link>
          ) : null}
          <BrandGuideLobby
            game={game}
            highlightNickname={nickname}
            playable={playable}
            onStartPractice={handleStartPractice}
            onStartGame={handleStartGame}
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
          hideRankingButton={gameId === "yanmar"}
          hideFullscreenButton={gameId === "yanmar"}
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
          />
        </GameImmersiveOverlay>
      ) : null}

      {gameId === "yanmar" && phase === "playing" && result ? (
        <GameResultScreen
          gameId={gameId}
          result={result}
          onStay={handleStay}
          onExit={handleExitHome}
        />
      ) : null}

      <RankingBoard
        gameId={gameId}
        open={showRanking}
        onClose={() => setShowRanking(false)}
        highlightNickname={nickname}
      />
    </>
  );
}
