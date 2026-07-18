"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  GAME_IMMERSIVE_HEADER_RIGHT_ID,
  useImmersiveFullscreenControl,
} from "@/components/games/GameImmersiveOverlay";
import { CustomerInquiryModal } from "@/components/games/CustomerInquiryModal";
import { MailboxModal } from "@/components/layout/MailboxModal";
import { InventoryModal } from "@/components/layout/InventoryModal";
import {
  isApiFullscreenActive,
  isStandalonePwa,
  requestFullscreen,
  shouldUseBrowserFullscreen,
} from "@/lib/fullscreen";
import { useRegisterInGameBackDismiss } from "@/hooks/useInGameBackNavigation";
import { HORN_OPTIONS, type HornId } from "./soundSettings";

type SettingsTab = "display" | "sound" | "other";

function ToggleRow({
  label,
  on,
  onToggle,
  disabled = false,
  indented = false,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  indented?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`flex w-full items-center justify-between rounded-lg py-2 text-left font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${
        indented ? "px-2.5 pl-5 text-[10px]" : "px-2.5 text-[11px]"
      }`}
    >
      <span>{label}</span>
      <span className={on && !disabled ? "text-sky-300" : "text-white/45"}>
        {on ? "ON" : "OFF"}
      </span>
    </button>
  );
}

function VolumeSlider({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-2.5 pb-2 pt-0.5 ${
        disabled ? "pointer-events-none opacity-35" : ""
      }`}
    >
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        disabled={disabled}
        aria-label="음량"
        aria-valuetext={`${value}`}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={(e) => e.stopPropagation()}
        className="yanmar-volume-slider h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-sky-400 disabled:cursor-not-allowed"
      />
      <span className="w-7 shrink-0 text-right text-[10px] font-bold tabular-nums text-white/80">
        {value}
      </span>
    </div>
  );
}

function SoundSection({
  title,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="mb-1.5 rounded-lg bg-white/[0.05] px-0.5 pb-1 pt-0.5">
      <div className="flex items-center justify-between gap-2 px-2.5 pb-0.5 pt-1.5">
        <h3 className="text-[11px] font-bold tracking-wide text-white">
          {title}
        </h3>
        <button
          type="button"
          onClick={onToggle}
          onPointerDown={(e) => e.stopPropagation()}
          aria-pressed={enabled}
          className={`rounded-md px-2.5 py-1 text-[10px] font-black tracking-wide transition-colors ${
            enabled
              ? "bg-sky-400/20 text-sky-300 ring-1 ring-sky-300/40"
              : "bg-white/8 text-white/40 ring-1 ring-white/10"
          }`}
        >
          {enabled ? "ON" : "OFF"}
        </button>
      </div>
      {children}
    </section>
  );
}

function SfxDetailGroup({
  disabled,
  children,
}: {
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`mx-2 mt-1 rounded-md border border-white/10 bg-black/25 py-1 ${
        disabled ? "opacity-40" : ""
      }`}
    >
      <p className="px-2.5 pb-0.5 text-[9px] font-bold tracking-wide text-white/40">
        세부 효과음
      </p>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function SfxDetailRow({
  label,
  disabled,
  children,
}: {
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-2 px-2.5 py-1.5 ${
        disabled ? "pointer-events-none" : ""
      }`}
    >
      <span className="truncate text-[10px] font-semibold text-white">{label}</span>
      <div className="flex w-full justify-end">{children}</div>
    </div>
  );
}

function BreakerDetailRow({
  on,
  onToggle,
  disabled,
}: {
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <SfxDetailRow label="브레이커 타격" disabled={disabled}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={on}
        className={`w-full rounded-md px-2 py-1 text-center text-[10px] font-black tracking-wide transition-colors disabled:cursor-not-allowed ${
          on && !disabled
            ? "bg-sky-400/20 text-sky-300 ring-1 ring-sky-300/40"
            : "bg-white/8 text-white/40 ring-1 ring-white/10"
        }`}
      >
        {on ? "ON" : "OFF"}
      </button>
    </SfxDetailRow>
  );
}

function HornDetailRow({
  hornId,
  onHornIdChange,
  disabled,
}: {
  hornId: HornId;
  onHornIdChange: (hornId: HornId) => void;
  disabled?: boolean;
}) {
  return (
    <SfxDetailRow label="경적 소리" disabled={disabled}>
      <select
        value={hornId}
        disabled={disabled}
        onChange={(e) => onHornIdChange(Number(e.target.value) as HornId)}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-full rounded-md border border-white/15 bg-black/70 px-1.5 py-1 text-[10px] font-semibold text-white outline-none focus:border-sky-400/60 disabled:cursor-not-allowed"
      >
        {HORN_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </SfxDetailRow>
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
  /** External settings button (title/login screen). Positions the panel when anchored. */
  anchorRef?: RefObject<HTMLElement | null>;
  /** Hide the built-in gear; use with `anchorRef`. */
  hideTrigger?: boolean;
  /** `modal` centers the panel (login/title). Default anchors below the trigger. */
  presentation?: "anchored" | "modal";
  showMinimap: boolean;
  onToggleMinimap: () => void;
  showMissionQuest: boolean;
  onToggleMissionQuest: () => void;
  bgmEnabled: boolean;
  onToggleBgm: () => void;
  bgmVolume: number;
  onBgmVolumeChange: (volume: number) => void;
  sfxEnabled: boolean;
  onToggleSfx: () => void;
  sfxVolume: number;
  onSfxVolumeChange: (volume: number) => void;
  breakerSfxEnabled: boolean;
  onToggleBreakerSfx: () => void;
  hornId: HornId;
  onHornIdChange: (hornId: HornId) => void;
  onResetPosition?: () => void;
  onShowGuide?: () => void;
  onShowRanking?: () => void;
  onSaveAndExit?: () => void;
  onLogout?: () => void;
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
  anchorRef,
  hideTrigger = false,
  presentation = "anchored",
  showMinimap,
  onToggleMinimap,
  showMissionQuest,
  onToggleMissionQuest,
  bgmEnabled,
  onToggleBgm,
  bgmVolume,
  onBgmVolumeChange,
  sfxEnabled,
  onToggleSfx,
  sfxVolume,
  onSfxVolumeChange,
  breakerSfxEnabled,
  onToggleBreakerSfx,
  hornId,
  onHornIdChange,
  onResetPosition,
  onShowGuide,
  onShowRanking,
  onSaveAndExit,
  onLogout,
}: YanmarGameSettingsMenuProps) {
  const isModal = presentation === "modal";
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(
    null,
  );
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [mailboxOpen, setMailboxOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [apiFullscreen, setApiFullscreen] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("display");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const immersiveFullscreen = useImmersiveFullscreenControl();
  const isStandalone = immersiveFullscreen?.isStandalone ?? isStandalonePwa();
  const canFullscreen =
    immersiveFullscreen?.canFullscreen ??
    (shouldUseBrowserFullscreen() && !isStandalone);
  const inApiFullscreen =
    immersiveFullscreen?.apiFullscreen ?? apiFullscreen;

  useRegisterInGameBackDismiss(open, () => onOpenChange(false));

  useEffect(() => {
    if (immersiveFullscreen) return;
    const sync = () => setApiFullscreen(isApiFullscreenActive());
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, [immersiveFullscreen]);

  useEffect(() => {
    if (!immersive || hideTrigger) {
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
  }, [immersive, hideTrigger]);

  useLayoutEffect(() => {
    if (!open || isModal) {
      setPanelPos(null);
      return;
    }

    const updatePos = () => {
      const rect =
        (anchorRef?.current ?? buttonRef.current)?.getBoundingClientRect();
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
  }, [open, anchorRef, isModal]);

  useEffect(() => {
    if (!open) setTab("display");
  }, [open]);

  useEffect(() => {
    if (!open || !isModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, isModal, onOpenChange]);

  if (!show) return null;

  const panelBody = (
    <div
      role="dialog"
      aria-modal={isModal ? true : undefined}
      aria-label="설정"
      className={`flex flex-col overflow-hidden rounded-xl border border-white/15 bg-black/90 shadow-2xl backdrop-blur-md ${
        isModal
          ? "relative z-[410] w-[min(100%,19.5rem)]"
          : "fixed z-[410] w-56"
      }`}
      style={
        isModal
          ? undefined
          : panelPos
            ? { top: panelPos.top, right: panelPos.right }
            : { top: 48, right: 12 }
      }
      onClick={(e) => e.stopPropagation()}
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
            <ToggleRow
              label="미션퀘스트"
              on={showMissionQuest}
              onToggle={onToggleMissionQuest}
            />
          </>
        ) : null}

        {tab === "sound" ? (
          <>
            <SoundSection title="배경음" enabled={bgmEnabled} onToggle={onToggleBgm}>
              <VolumeSlider
                value={bgmVolume}
                onChange={onBgmVolumeChange}
                disabled={!bgmEnabled}
              />
            </SoundSection>

            <SoundSection title="효과음" enabled={sfxEnabled} onToggle={onToggleSfx}>
              <VolumeSlider
                value={sfxVolume}
                onChange={onSfxVolumeChange}
                disabled={!sfxEnabled}
              />
              <SfxDetailGroup disabled={!sfxEnabled}>
                <BreakerDetailRow
                  on={breakerSfxEnabled}
                  onToggle={onToggleBreakerSfx}
                  disabled={!sfxEnabled}
                />
                <HornDetailRow
                  hornId={hornId}
                  onHornIdChange={onHornIdChange}
                  disabled={!sfxEnabled}
                />
              </SfxDetailGroup>
            </SoundSection>
          </>
        ) : null}

        {tab === "other" ? (
          <>
            {onResetPosition ? (
              <ActionRow
                label="초기위치(끼임시 탈출)"
                onClick={() => {
                  onOpenChange(false);
                  onResetPosition();
                }}
              />
            ) : null}
            {canFullscreen && !inApiFullscreen && !isStandalone ? (
              <ActionRow
                label="전체화면"
                onClick={() => {
                  onOpenChange(false);
                  if (immersiveFullscreen) {
                    void immersiveFullscreen.enter();
                  } else {
                    void requestFullscreen(null);
                  }
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
              label="게임방법"
              onClick={() => {
                onOpenChange(false);
                onShowGuide?.();
              }}
              disabled={!onShowGuide}
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
            {onLogout ? (
              <ActionRow
                label="로그아웃"
                onClick={() => {
                  onOpenChange(false);
                  onLogout();
                }}
              />
            ) : null}
          </>
        ) : null}
      </div>

      {onSaveAndExit ? (
        <div className="border-t border-white/10 px-1 py-1">
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              void immersiveFullscreen?.leave();
              onSaveAndExit();
            }}
            className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-rose-300 hover:bg-white/10"
          >
            게임 저장 후 종료
          </button>
        </div>
      ) : null}
    </div>
  );

  const panel = open ? (
    isModal ? (
      <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 cursor-default bg-black/55"
          aria-label="메뉴 닫기"
          onClick={() => onOpenChange(false)}
        />
        {panelBody}
      </div>
    ) : (
      <>
        <button
          type="button"
          className="fixed inset-0 z-[400] cursor-default"
          aria-label="메뉴 닫기"
          onClick={() => onOpenChange(false)}
        />
        {panelBody}
      </>
    )
  ) : null;

  const trigger = hideTrigger ? null : (
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

  if (hideTrigger) {
    return menu;
  }

  if (immersive && headerSlot) {
    return createPortal(menu, headerSlot);
  }

  return <div className="absolute right-2 top-2 z-[70] pointer-events-auto">{menu}</div>;
}
