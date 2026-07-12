"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { GameTickerBoard } from "@/components/games/GameTickerBoard";
import { useGameFullscreen } from "@/hooks/useGameFullscreen";
import {
  enableInGamePortrait,
  isApiFullscreenActive,
} from "@/lib/fullscreen";
import { enablePwaMode } from "@/lib/pwa-mode";

export const GAME_IMMERSIVE_HEADER_LEFT_ID = "game-immersive-header-left";
export const GAME_IMMERSIVE_HEADER_CENTER_ID = "game-immersive-header-center";
export const GAME_IMMERSIVE_HEADER_RIGHT_ID = "game-immersive-header-right";

interface ImmersiveFullscreenControl {
  canFullscreen: boolean;
  apiFullscreen: boolean;
  isStandalone: boolean;
  enter: () => Promise<void>;
  leave: () => Promise<void>;
}

const ImmersiveFullscreenContext = createContext<ImmersiveFullscreenControl | null>(null);

export function useImmersiveFullscreenControl() {
  return useContext(ImmersiveFullscreenContext);
}

interface GameImmersiveOverlayProps {
  active: boolean;
  headerColor: string;
  onExit: () => void;
  onShowRanking: () => void;
  myRank: number | null;
  bestScore: number;
  hideHeaderStats?: boolean;
  hideExitButton?: boolean;
  hideRankingButton?: boolean;
  hideFullscreenButton?: boolean;
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
  hideExitButton = false,
  hideRankingButton = false,
  hideFullscreenButton = false,
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
    <ImmersiveFullscreenContext.Provider
      value={{ canFullscreen, apiFullscreen, isStandalone, enter, leave }}
    >
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
        className="relative z-30 grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 px-3 py-2 text-white pointer-events-auto"
        style={{ backgroundColor: headerColor }}
      >
        <div className="flex min-w-0 max-w-full items-center gap-2 justify-self-stretch overflow-hidden">
          {!hideExitButton ? (
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
          ) : null}
          <div id={GAME_IMMERSIVE_HEADER_LEFT_ID} className="flex min-w-0 max-w-full flex-1 items-center overflow-hidden" />
        </div>
        <div
          id={GAME_IMMERSIVE_HEADER_CENTER_ID}
          className="z-[1] flex shrink-0 items-center justify-center justify-self-center"
        />
        <div className="flex shrink-0 items-center justify-end gap-2 justify-self-end">
          <div
            id={GAME_IMMERSIVE_HEADER_RIGHT_ID}
            className="flex shrink-0 items-center justify-end gap-2"
          />
          {!hideHeaderStats && (
            <span className="shrink-0 text-[10px] opacity-80">
              {myRank ? `#${myRank}` : "-"} · {bestScore > 0 ? `${bestScore}점` : "0점"}
            </span>
          )}
          {!hideFullscreenButton && canFullscreen && !apiFullscreen && !isStandalone && (
            <button
              type="button"
              onClick={() => {
                void enter();
              }}
              className="shrink-0 rounded-lg bg-white/20 px-2 py-1 text-[10px] font-semibold"
            >
              ⛶ 전체화면
            </button>
          )}
          {!hideRankingButton && (
            <button
              type="button"
              onClick={onShowRanking}
              className="shrink-0 rounded-lg bg-white/20 px-2 py-1 text-[10px] font-semibold"
            >
              📊
            </button>
          )}
        </div>
      </div>
      <GameTickerBoard includePractice={showPracticeTicker} />
      {/* z-0 traps in-game stacking (e.g. minimap z-30) below the header menu dropdown */}
      <div className="relative z-0 min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </ImmersiveFullscreenContext.Provider>,
    document.body,
  );
}
