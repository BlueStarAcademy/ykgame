"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useGameFullscreen } from "@/hooks/useGameFullscreen";

export const GAME_IMMERSIVE_HEADER_RIGHT_ID = "game-immersive-header-right";

interface GameImmersiveOverlayProps {
  active: boolean;
  headerColor: string;
  brandKo: string;
  onExit: () => void;
  onShowRanking: () => void;
  myRank: number | null;
  bestScore: number;
  hideHeaderStats?: boolean;
  hideRankingButton?: boolean;
  children: React.ReactNode;
}

export function GameImmersiveOverlay({
  active,
  headerColor,
  brandKo,
  onExit,
  onShowRanking,
  myRank,
  bestScore,
  hideHeaderStats = false,
  hideRankingButton = false,
  children,
}: GameImmersiveOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { immersive, canFullscreen, apiFullscreen, isStandalone, enter, leave } =
    useGameFullscreen({ active, containerRef });

  useEffect(() => {
    if (active) {
      enter();
    } else {
      leave();
    }
    return () => {
      leave();
    };
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
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              leave();
              onExit();
            }}
            className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold"
          >
            ✕ 종료
          </button>
          <span className="text-xs font-medium opacity-90">{brandKo}</span>
        </div>
        <div className="flex items-center gap-2">
          <div id={GAME_IMMERSIVE_HEADER_RIGHT_ID} className="flex items-center" />
          {!hideHeaderStats && (
            <span className="text-[10px] opacity-80">
              {myRank ? `#${myRank}` : "-"} · {bestScore > 0 ? `${bestScore}점` : "0점"}
            </span>
          )}
          {canFullscreen && !apiFullscreen && !isStandalone && (
            <button
              type="button"
              onClick={() => enter()}
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
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>,
    document.body,
  );
}
