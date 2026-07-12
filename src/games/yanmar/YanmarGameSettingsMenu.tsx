"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  GAME_IMMERSIVE_HEADER_RIGHT_ID,
  useImmersiveFullscreenControl,
} from "@/components/games/GameImmersiveOverlay";

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
  onResetPosition: () => void;
  onShowRanking?: () => void;
  onSaveAndExit?: () => void;
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
  onResetPosition,
  onShowRanking,
  onSaveAndExit,
}: YanmarGameSettingsMenuProps) {
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const fullscreen = useImmersiveFullscreenControl();

  useEffect(() => {
    if (!immersive) {
      setHeaderSlot(null);
      return;
    }
    setHeaderSlot(document.getElementById(GAME_IMMERSIVE_HEADER_RIGHT_ID));
  }, [immersive]);

  if (!show) return null;

  const menu = (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/30"
        aria-label="메뉴"
        aria-expanded={open}
      >
        <img
          src="/images/yanmar/2d/cockpit/menu-premium.png?v=1"
          alt=""
          draggable={false}
          className="h-5 w-5 object-contain"
        />
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[250] cursor-default"
            aria-label="메뉴 닫기"
            onClick={() => onOpenChange(false)}
          />
          <div className="absolute right-0 top-full z-[260] mt-1 w-44 overflow-hidden rounded-xl border border-white/15 bg-black/90 py-1 shadow-2xl backdrop-blur-md">
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
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onResetPosition();
              }}
              className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-white hover:bg-white/10"
            >
              초기위치
            </button>
            {fullscreen?.canFullscreen &&
            !fullscreen.apiFullscreen &&
            !fullscreen.isStandalone ? (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  void fullscreen.enter();
                }}
                className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-white hover:bg-white/10"
              >
                전체화면
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onShowRanking?.();
              }}
              disabled={!onShowRanking}
              className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-white hover:bg-white/10 disabled:text-white/35"
            >
              랭킹보드
            </button>
            {onSaveAndExit ? (
              <>
                <div className="mx-2 my-1 border-t border-white/10" />
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    void fullscreen?.leave();
                    onSaveAndExit();
                  }}
                  className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-rose-300 hover:bg-white/10"
                >
                  게임 저장 후 종료
                </button>
              </>
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
