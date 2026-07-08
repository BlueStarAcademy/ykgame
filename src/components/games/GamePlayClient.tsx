"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { GameCardSprite } from "@/components/home/GameCardSprite";
import { PhaserGameWrapper } from "@/components/games/PhaserGameWrapper";
import { GameImmersiveOverlay } from "@/components/games/GameImmersiveOverlay";
import { RankingBoard } from "@/components/games/RankingBoard";
import type { GameConfig, GameId } from "@/lib/games";
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
type PlayMode = "practice" | "game";

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

const YANMAR_STEPS = [
  { icon: "🟠", title: "굴착", desc: "주황 구역에서 흙 채취" },
  { icon: "🟢", title: "하역", desc: "초록 구역에 토사 투하" },
  { icon: "💥", title: "크리티컬", desc: "확률 보너스 점수" },
  { icon: "⚙️", title: "장비강화", desc: "스타로 능력 업그레이드" },
];

const YANMAR_REWARDS = [
  { icon: "⭐", label: "스타", desc: "1~10개 랜덤" },
  { icon: "🎟️", label: "YK 부품 할인권", desc: "10 / 15 / 20%" },
  { icon: "🎟️", label: "장비 대여 할인권", desc: "10 / 20 / 30%" },
  { icon: "💥", label: "크리티컬 점수", desc: "확률 보너스" },
];

function YanmarGuideLobby({
  game,
  myStats,
  onStartPractice,
  onStartGame,
  onShowRanking,
}: {
  game: GameConfig;
  myStats: MyStats;
  onStartPractice: () => void;
  onStartGame: () => void;
  onShowRanking: () => void;
}) {
  return (
    <div className="game-lobby-shell">
      <div
        className="game-lobby-hero"
        style={{
          background: `linear-gradient(145deg, ${game.color} 0%, ${game.headerColor} 45%, #1a0a0a 100%)`,
        }}
      >
        <div className="game-lobby-hero-inner">
          <div className="game-lobby-hero-copy">
            <p className="game-lobby-brand">{game.brandEn}</p>
            <h2 className="game-lobby-title">{game.mission}</h2>
          </div>
          <div className="game-lobby-hero-art" aria-hidden>
            <GameCardSprite gameId={game.id} />
          </div>
        </div>
      </div>

      <div className="game-lobby-body">
        <section className="game-lobby-section">
          <h3 className="game-lobby-section-label">플레이 가이드</h3>
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

        <section className="game-lobby-section space-y-2">
          <button
            type="button"
            onClick={onStartPractice}
            className="game-lobby-mode game-lobby-mode-practice"
          >
            <span className="game-lobby-mode-icon game-lobby-mode-icon-practice">🎓</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-slate-900">연습모드 입장</span>
              <span className="mt-0.5 block text-[10px] font-medium text-slate-500">
                튜토리얼 · 자유동작
              </span>
            </span>
            <span className="game-lobby-mode-cta bg-blue-600">입장</span>
          </button>

          <button
            type="button"
            onClick={onStartGame}
            className="game-lobby-mode game-lobby-mode-game"
          >
            <span
              className="game-lobby-mode-icon"
              style={{
                background: `linear-gradient(145deg, ${game.color} 0%, ${game.headerColor} 100%)`,
              }}
            >
              🏆
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-slate-900">게임모드 시작</span>
              <span className="mt-0.5 block text-[10px] font-medium text-slate-500">
                점수 · 보상 도전
              </span>
            </span>
            <span
              className="game-lobby-mode-cta"
              style={{ background: `linear-gradient(145deg, ${game.color}, ${game.headerColor})` }}
            >
              시작
            </span>
          </button>
        </section>

        <section className="game-lobby-section">
          <h3 className="game-lobby-section-label">나올 수 있는 보상</h3>
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

        <section className="game-lobby-rank-row">
          <div className="game-lobby-rank-card">
            <p className="game-lobby-rank-label">내 순위</p>
            <p className="game-lobby-rank-value">
              {myStats.rank ? `#${myStats.rank}` : "—"}
            </p>
          </div>
          <button type="button" onClick={onShowRanking} className="game-lobby-rank-btn">
            📊 랭킹보드
          </button>
        </section>
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

export function GamePlayClient({ gameId }: GamePlayClientProps) {
  const game = getGameById(gameId);
  const { data: session } = useSession();
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [playMode, setPlayMode] = useState<PlayMode | null>(null);
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

  const handleStartPractice = () => {
    setPlayMode("practice");
    setPhase("playing");
  };

  const handleStartGame = () => {
    setPlayMode("game");
    setPhase("playing");
  };

  const handleStart = () => {
    setPlayMode(null);
    setPhase("playing");
  };

  const handleExitGame = () => {
    setPlayMode(null);
    setPhase("lobby");
  };

  const handleGameEnd = (gameResult: GameResult) => {
    setResult(gameResult);
    setPhase("result");
  };

  const handleRetry = () => {
    setResult(null);
    setPlayMode(null);
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
      <Link href="/home" className="game-page-back">
        <span aria-hidden>←</span> 홈으로
      </Link>

      {phase === "lobby" &&
        (gameId === "yanmar" ? (
          <YanmarGuideLobby
            game={game}
            myStats={myStats}
            onStartPractice={handleStartPractice}
            onStartGame={handleStartGame}
            onShowRanking={() => setShowRanking(true)}
          />
        ) : (
          <DefaultGameLobby
            game={game}
            myStats={myStats}
            onStart={handleStart}
            onShowRanking={() => setShowRanking(true)}
          />
        ))}

      {phase === "playing" && (
        <GameImmersiveOverlay
          active
          headerColor={game.headerColor}
          brandKo={game.brandKo}
          onExit={handleExitGame}
          onShowRanking={() => setShowRanking(true)}
          myRank={myStats.rank}
          bestScore={myStats.bestScore}
          hideHeaderStats={gameId === "yanmar"}
          hideRankingButton={gameId === "yanmar"}
        >
          <PhaserGameWrapper
            gameId={gameId}
            onEnd={handleGameEnd}
            immersive
            initialPlayMode={playMode ?? undefined}
            onShowRanking={() => setShowRanking(true)}
            myRank={myStats.rank}
            bestScore={myStats.bestScore}
          />
        </GameImmersiveOverlay>
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
