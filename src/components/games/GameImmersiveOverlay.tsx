"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useGameFullscreen } from "@/hooks/useGameFullscreen";
import {
  enableInGamePortrait,
  isApiFullscreenActive,
} from "@/lib/fullscreen";
import { enablePwaMode } from "@/lib/pwa-mode";

export const GAME_IMMERSIVE_HEADER_LEFT_ID = "game-immersive-header-left";
export const GAME_IMMERSIVE_HEADER_RIGHT_ID = "game-immersive-header-right";

const PRACTICE_TICKER_MESSAGE = "연습모드에서는 재화나 점수가 누적되지 않습니다.";

function PracticeModeTicker() {
  return (
    <div className="yanmar-practice-ticker shrink-0 overflow-hidden py-1.5" aria-live="polite">
      <div className="yanmar-practice-ticker-track">
        <span className="yanmar-practice-ticker-item">{PRACTICE_TICKER_MESSAGE}</span>
        <span className="yanmar-practice-ticker-item" aria-hidden>
          {PRACTICE_TICKER_MESSAGE}
        </span>
      </div>
    </div>
  );
}

interface GameImmersiveOverlayProps {
  active: boolean;
  headerColor: string;
  onExit: () => void;
  onShowRanking: () => void;
  myRank: number | null;
  bestScore: number;
  hideHeaderStats?: boolean;
  hideRankingButton?: boolean;
  showPracticeTicker?: boolean;
  children: React.ReactNode;
}

export function GameImmersiveOverlay({
  active,
  headerColor,
  onExit,
  onShowRanking,
  myRank,
  bestScore,
  hideHeaderStats = false,
  hideRankingButton = false,
  showPracticeTicker = false,
  children,
}: GameImmersiveOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { canFullscreen, apiFullscreen, isStandalone, enter, leave } =
    useGameFullscreen({ active, containerRef });

  useEffect(() => {
    if (!active) {
      void leave();
      return;
    }

    enablePwaMode();
    document.documentElement.classList.add("pwa-mode");

    // 모드 버튼/탑승 카드 클릭에서 이미 Fullscreen 진입한 경우:
    // 제스처 없이 재요청하지 않고 세로 강제만 유지한다.
    // Strict Mode remount 시 cleanup에서 exitFullscreen 하면 제스처가 사라져
    // 재진입이 실패하므로, FS 해제는 active=false / 종료 버튼에서만 한다.
    if (isApiFullscreenActive()) {
      void enableInGamePortrait();
    } else {
      void enter();
    }
  }, [active, enter, leave]);

  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  if (!active) return <>{children}</>;

  return createPortal(
    <div
      ref={containerRef}
      data-game-immersive=""
      className="fixed inset-0 z-[200] flex flex-col bg-black"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div
        className="flex shrink-0 items-center justify-between px-3 py-2 text-white"
        style={{ backgroundColor: headerColor }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void leave();
              onExit();
            }}
            className="shrink-0 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold"
          >
            ✕ 종료
          </button>
          <div id={GAME_IMMERSIVE_HEADER_LEFT_ID} className="flex min-w-0 items-center" />
        </div>
        <div className="flex items-center gap-2">
          <div id={GAME_IMMERSIVE_HEADER_RIGHT_ID} className="flex items-center gap-3" />
          {!hideHeaderStats && (
            <span className="text-[10px] opacity-80">
              {myRank ? `#${myRank}` : "-"} · {bestScore > 0 ? `${bestScore}점` : "0점"}
            </span>
          )}
          {canFullscreen && !apiFullscreen && !isStandalone && (
            <button
              type="button"
              onClick={() => {
                void enter();
              }}
              className="rounded-lg bg-white/20 px-2 py-1 text-[10px] font-semibold"
            >
              ⛶ 전체화면
            </button>
          )}
          {!hideRankingButton && (
            <button
              type="button"
              onClick={onShowRanking}
              className="rounded-lg bg-white/20 px-2 py-1 text-[10px] font-semibold"
            >
              📊
            </button>
          )}
        </div>
      </div>
      {showPracticeTicker ? <PracticeModeTicker /> : null}
      <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>,
    document.body,
  );
}
