"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { GameCardSprite } from "@/components/home/GameCardSprite";
import { HomeProfilePanel } from "@/components/home/HomeProfilePanel";
import { PhaserGameWrapper } from "@/components/games/PhaserGameWrapper";
import { GameImmersiveOverlay } from "@/components/games/GameImmersiveOverlay";
import { RankingBoard, RankingBoardPanel } from "@/components/games/RankingBoard";
import type { GameConfig, GameId } from "@/lib/games";
import { getGameById, isGameAvailable } from "@/lib/games";
import { prepareInGameFullscreen } from "@/lib/fullscreen";
import { enablePwaMode } from "@/lib/pwa-mode";
import type { GameResult } from "@/games/shared/types";
import { GameResultScreen } from "./GameResultScreen";

/** 모드 버튼 클릭(사용자 제스처)에서 전체화면 + 세로 고정 후 인게임 진입 */
async function enterPlayingAfterGesture(start: () => void): Promise<void> {
  enablePwaMode();
  await prepareInGameFullscreen();
  start();
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
type LobbyTab = "guide" | "rewards" | "ranking";

const YANMAR_LOBBY_TITLE = "얀마! 너 뭐해?";

const YANMAR_STEPS = [
  {
    icon: "🎮",
    title: "모드 선택",
    desc: "연습은 조작만 익히고, 게임은 점수·보상·랭킹에 도전합니다",
  },
  {
    icon: "🕹️",
    title: "기본 조작",
    desc: "좌·우 레버와 주행으로 조작하고, 기능 메뉴에서 부착물을 바꿉니다",
  },
  {
    icon: "🟠",
    title: "굴착 · 하역",
    desc: "주황 구역에서 흙을 담아 덤프트럭에 하역합니다",
  },
  {
    icon: "💥",
    title: "브레이커",
    desc: "브레이커로 아스팔트를 깨면 보상을 얻습니다",
  },
  {
    icon: "🪨",
    title: "집게 · 석재",
    desc: "집게로 돌을 집어 운반 트럭에 하역합니다",
  },
  {
    icon: "🎁",
    title: "보상 · 강화",
    desc: "스타·쿠폰을 모아 장비를 강화하고 시즌 랭킹에 도전합니다",
  },
];

const YANMAR_REWARDS = [
  {
    icon: "⭐",
    label: "스타",
    desc: "무제한",
  },
  { icon: "🎟️", label: "YK 부품 할인권", desc: "10 / 15 / 20%" },
  { icon: "🎟️", label: "장비 대여 할인권", desc: "10 / 20 / 30%" },
  {
    icon: "🎟️",
    label: "필터 세트 교환 쿠폰",
    desc: "시즌 한정 교환권",
  },
];

function BrandGuideLobby({
  game,
  highlightNickname,
  lobbyProfile,
  showBack = false,
  onStartPractice,
  onStartGame,
}: {
  game: GameConfig;
  highlightNickname: string;
  lobbyProfile?: LobbyProfileProps;
  showBack?: boolean;
  onStartPractice: () => void;
  onStartGame: () => void;
}) {
  const [activeTab, setActiveTab] = useState<LobbyTab>("guide");
  const title = YANMAR_LOBBY_TITLE;

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
        {showBack || lobbyProfile?.seasonLabel ? (
          <div className="game-lobby-hero-top">
            {showBack ? (
              <Link href="/" className="game-lobby-hero-back" aria-label="뒤로가기">
                <span aria-hidden>←</span>
                <span>뒤로가기</span>
              </Link>
            ) : (
              <span />
            )}
            {lobbyProfile?.seasonLabel ? (
              <span className="game-lobby-hero-season">{lobbyProfile.seasonLabel}</span>
            ) : null}
          </div>
        ) : null}
        <div className="game-lobby-hero-inner">
          <div className="game-lobby-hero-copy">
            <p className="game-lobby-brand">{game.brandEn}</p>
            <h2 className="game-lobby-title">{title}</h2>
          </div>
          <div className="game-lobby-hero-art" aria-hidden>
            <GameCardSprite gameId={game.id} />
          </div>
        </div>
      </div>

      {lobbyProfile ? (
        <div className="game-lobby-profile shrink-0 px-1 pt-1.5">
          <HomeProfilePanel
            nickname={highlightNickname || "PLAYER"}
            totalXp={lobbyProfile.totalXp}
            rank={lobbyProfile.rank}
            seasonScore={lobbyProfile.seasonScore}
            highlightGameName={lobbyProfile.highlightGameName ?? "얀마"}
            seasonLabel={lobbyProfile.seasonLabel}
          />
        </div>
      ) : null}

      <div className="game-lobby-tabs-bar shrink-0 px-1 pt-1.5" role="tablist" aria-label="로비 정보">
        <div className="game-lobby-tabs">
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
              <span className="game-lobby-mode-copy-desc">점수/보상/랭킹 도전</span>
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
      setYanmarSeasonBaseScore(0);
      setYanmarExitSignal(0);
      setPhase("playing");
    });
  };

  const handleStartGame = () => {
    if (!playable) return;
    void enterPlayingAfterGesture(() => {
      setResult(null);
      setPlayMode("game");
      setYanmarSeasonBaseScore(myStats.bestScore);
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
    setYanmarExitSignal(0);
    void loadStats();
  };

  if (!game) return null;

  const displayNickname = session?.user?.nickname ?? "";
  const totalXp = session?.user?.totalXp ?? lobbyProfile?.totalXp ?? 0;

  const resolvedLobbyProfile: LobbyProfileProps | undefined = lobbyProfile
    ? {
        ...lobbyProfile,
        totalXp,
        rank: myStats.rank,
        seasonScore: myStats.bestScore,
      }
    : undefined;

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
          <BrandGuideLobby
            game={game}
            highlightNickname={displayNickname}
            lobbyProfile={resolvedLobbyProfile}
            showBack={!standalone}
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
          hideExitButton={gameId === "yanmar"}
          hideRankingButton={gameId === "yanmar"}
          hideFullscreenButton={gameId === "yanmar"}
          showPracticeTicker={playMode === "practice"}
        >
          <PhaserGameWrapper
            gameId={gameId}
            onEnd={handleGameEnd}
            exitSignal={yanmarExitSignal}
            resumeSignal={yanmarResumeSignal}
            scoreCommit={yanmarScoreCommit}
            immersive
            initialPlayMode={playMode ?? undefined}
            onShowRanking={() => setShowRanking(true)}
            onRequestExit={handleExitGame}
            seasonScoreBase={yanmarSeasonBaseScore}
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

      <RankingBoard
        gameId={gameId}
        open={showRanking}
        onClose={() => setShowRanking(false)}
        highlightNickname={displayNickname}
      />
    </>
  );
}
