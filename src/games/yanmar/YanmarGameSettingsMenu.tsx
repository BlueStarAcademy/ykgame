"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  GAME_IMMERSIVE_HEADER_RIGHT_ID,
  useImmersiveFullscreenControl,
} from "@/components/games/GameImmersiveOverlay";
import { CustomerInquiryModal } from "@/components/games/CustomerInquiryModal";
import { MailboxModal } from "@/components/layout/MailboxModal";
import { InventoryModal } from "@/components/layout/InventoryModal";
import { HORN_OPTIONS, type HornId } from "./soundSettings";

type SettingsTab = "display" | "sound" | "other";

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

function ActionRow({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-white hover:bg-white/10 disabled:text-white/35"
    >
      {label}
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
  showTouchZones: boolean;
  onToggleTouchZones: () => void;
  touchZonesAvailable: boolean;
  showMissionQuest: boolean;
  onToggleMissionQuest: () => void;
  bgmEnabled: boolean;
  onToggleBgm: () => void;
  sfxEnabled: boolean;
  onToggleSfx: () => void;
  hornId: HornId;
  onHornIdChange: (hornId: HornId) => void;
  onResetPosition: () => void;
  onShowRanking?: () => void;
  onSaveAndExit?: () => void;
}

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "display", label: "화면" },
  { id: "sound", label: "소리" },
  { id: "other", label: "기타" },
];

export function YanmarGameSettingsMenu({
  immersive,
  show,
  open,
  onOpenChange,
  showMinimap,
  onToggleMinimap,
  showTouchZones,
  onToggleTouchZones,
  touchZonesAvailable,
  showMissionQuest,
  onToggleMissionQuest,
  bgmEnabled,
  onToggleBgm,
  sfxEnabled,
  onToggleSfx,
  hornId,
  onHornIdChange,
  onResetPosition,
  onShowRanking,
  onSaveAndExit,
}: YanmarGameSettingsMenuProps) {
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(
    null,
  );
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [mailboxOpen, setMailboxOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("display");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fullscreen = useImmersiveFullscreenControl();

  useEffect(() => {
    if (!immersive) {
      setHeaderSlot(null);
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const findSlot = () => {
      if (cancelled) return;
      const el = document.getElementById(GAME_IMMERSIVE_HEADER_RIGHT_ID);
      if (el) {
        setHeaderSlot(el);
        return;
      }
      attempts += 1;
      if (attempts < 20) {
        requestAnimationFrame(findSlot);
      }
    };

    findSlot();
    return () => {
      cancelled = true;
    };
  }, [immersive]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }

    const updatePos = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPanelPos({
        top: rect.bottom + 4,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };

    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setTab("display");
  }, [open]);

  if (!show) return null;

  const panel = open ? (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[400] cursor-default"
        aria-label="메뉴 닫기"
        onClick={() => onOpenChange(false)}
      />
      <div
        className="fixed z-[410] flex w-52 flex-col overflow-hidden rounded-xl border border-white/15 bg-black/90 shadow-2xl backdrop-blur-md"
        style={
          panelPos
            ? { top: panelPos.top, right: panelPos.right }
            : { top: 48, right: 12 }
        }
      >
        <div className="flex border-b border-white/10 px-1 pt-1">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex-1 rounded-t-md px-1 py-1.5 text-[10px] font-bold tracking-wide transition-colors ${
                  active
                    ? "bg-white/12 text-white"
                    : "text-white/45 hover:text-white/75"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-[9.5rem] px-1 py-1">
          {tab === "display" ? (
            <>
              <ToggleRow label="미니맵" on={showMinimap} onToggle={onToggleMinimap} />
              {touchZonesAvailable ? (
                <ToggleRow
                  label="터치범위"
                  on={showTouchZones}
                  onToggle={onToggleTouchZones}
                />
              ) : null}
              <ToggleRow
                label="미션퀘스트"
                on={showMissionQuest}
                onToggle={onToggleMissionQuest}
              />
            </>
          ) : null}

          {tab === "sound" ? (
            <>
              <ToggleRow label="배경음" on={bgmEnabled} onToggle={onToggleBgm} />
              <ToggleRow label="효과음" on={sfxEnabled} onToggle={onToggleSfx} />
              <label className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[11px] font-semibold text-white">
                <span>경적 소리</span>
                <select
                  value={hornId}
                  onChange={(e) => onHornIdChange(Number(e.target.value) as HornId)}
                  className="max-w-[5.5rem] rounded-md border border-white/15 bg-black/70 px-1.5 py-1 text-[10px] font-semibold text-white outline-none focus:border-sky-400/60"
                >
                  {HORN_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          {tab === "other" ? (
            <>
              <ActionRow
                label="초기위치(끼임시 탈출)"
                onClick={() => {
                  onOpenChange(false);
                  onResetPosition();
                }}
              />
              {fullscreen?.canFullscreen &&
              !fullscreen.apiFullscreen &&
              !fullscreen.isStandalone ? (
                <ActionRow
                  label="전체화면"
                  onClick={() => {
                    onOpenChange(false);
                    void fullscreen.enter();
                  }}
                />
              ) : null}
              <ActionRow
                label="우편함"
                onClick={() => {
                  onOpenChange(false);
                  setMailboxOpen(true);
                }}
              />
              <ActionRow
                label="쿠폰함"
                onClick={() => {
                  onOpenChange(false);
                  setInventoryOpen(true);
                }}
              />
              <ActionRow
                label="랭킹정보"
                onClick={() => {
                  onOpenChange(false);
                  onShowRanking?.();
                }}
                disabled={!onShowRanking}
              />
              <ActionRow
                label="고객문의"
                onClick={() => {
                  onOpenChange(false);
                  setInquiryOpen(true);
                }}
              />
            </>
          ) : null}
        </div>

        {onSaveAndExit ? (
          <div className="border-t border-white/10 px-1 py-1">
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
          </div>
        ) : null}
      </div>
    </>
  ) : null;

  const trigger = (
    <div className="relative z-[70] shrink-0 pointer-events-auto">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onOpenChange(!open)}
        className="relative z-[70] flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/30"
        aria-label="메뉴"
        aria-expanded={open}
      >
        <img
          src="/images/yanmar/2d/cockpit/menu-premium.png?v=1"
          alt=""
          draggable={false}
          className="pointer-events-none h-5 w-5 object-contain"
        />
      </button>
    </div>
  );

  const overlayRoot =
    typeof document !== "undefined"
      ? document.querySelector("[data-game-immersive]") ?? document.body
      : null;

  const menu = (
    <>
      {trigger}
      {panel && overlayRoot ? createPortal(panel, overlayRoot) : null}
      <CustomerInquiryModal open={inquiryOpen} onClose={() => setInquiryOpen(false)} />
      <MailboxModal open={mailboxOpen} onClose={() => setMailboxOpen(false)} />
      <InventoryModal open={inventoryOpen} onClose={() => setInventoryOpen(false)} />
    </>
  );

  if (immersive && headerSlot) {
    return createPortal(menu, headerSlot);
  }

  return <div className="absolute right-2 top-2 z-[70] pointer-events-auto">{menu}</div>;
}
