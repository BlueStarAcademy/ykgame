"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GAME_IMMERSIVE_HEADER_RIGHT_ID } from "@/components/games/GameImmersiveOverlay";

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ToggleRow({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-white hover:bg-white/10"
    >
      <span>{label}</span>
      <span className={on ? "text-sky-300" : "text-white/45"}>{on ? "ON" : "OFF"}</span>
    </button>
  );
}

interface YanmarGameSettingsMenuProps {
  immersive: boolean;
  show: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showMinimap: boolean;
  onToggleMinimap: () => void;
  showDigPose: boolean;
  onToggleDigPose: () => void;
  showTouchZones: boolean;
  onToggleTouchZones: () => void;
  touchZonesAvailable: boolean;
  onOpenControlsGuide: () => void;
  onShowRanking?: () => void;
  myRank?: number | null;
  bestScore?: number;
}

export function YanmarGameSettingsMenu({
  immersive,
  show,
  open,
  onOpenChange,
  showMinimap,
  onToggleMinimap,
  showDigPose,
  onToggleDigPose,
  showTouchZones,
  onToggleTouchZones,
  touchZonesAvailable,
  onOpenControlsGuide,
  onShowRanking,
  myRank = null,
  bestScore = 0,
}: YanmarGameSettingsMenuProps) {
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!immersive) {
      setHeaderSlot(null);
      return;
    }
    setHeaderSlot(document.getElementById(GAME_IMMERSIVE_HEADER_RIGHT_ID));
  }, [immersive]);

  if (!show) return null;

  const menu = (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/30"
        aria-label="설정"
        aria-expanded={open}
      >
        <GearIcon />
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[250] cursor-default"
            aria-label="설정 닫기"
            onClick={() => onOpenChange(false)}
          />
          <div className="absolute right-0 top-full z-[260] mt-1 w-40 overflow-hidden rounded-xl border border-white/15 bg-black/90 py-1 shadow-2xl backdrop-blur-md">
            <div className="border-b border-white/10 px-2.5 py-2">
              <p className="text-[10px] font-bold text-white/55">내 랭킹</p>
              <p className="mt-0.5 text-[11px] font-black text-white">
                {myRank ? `#${myRank}` : "순위 없음"}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold text-amber-200">
                최고 {bestScore > 0 ? `${bestScore.toLocaleString()}점` : "0점"}
              </p>
            </div>
            <ToggleRow label="미니맵" on={showMinimap} onToggle={onToggleMinimap} />
            <ToggleRow label="적재자세" on={showDigPose} onToggle={onToggleDigPose} />
            {touchZonesAvailable ? (
              <ToggleRow label="터치범위" on={showTouchZones} onToggle={onToggleTouchZones} />
            ) : null}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onOpenControlsGuide();
              }}
              className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-white hover:bg-white/10"
            >
              기능정보
            </button>
            {onShowRanking ? (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onShowRanking();
                }}
                className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-white hover:bg-white/10"
              >
                랭킹보드
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );

  if (immersive && headerSlot) {
    return createPortal(menu, headerSlot);
  }

  return <div className="absolute right-2 top-2 z-50">{menu}</div>;
}
