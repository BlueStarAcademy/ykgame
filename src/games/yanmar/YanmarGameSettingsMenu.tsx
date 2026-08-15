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
  exitFullscreen,
  isApiFullscreenActive,
  isStandalonePwa,
  requestFullscreen,
  shouldUseBrowserFullscreen,
} from "@/lib/fullscreen";
import { LanguagePicker } from "@/components/i18n/LanguagePicker";
import { disablePwaMode } from "@/lib/pwa-mode";
import { markResumeInGame } from "@/lib/resumeInGame";
import { useRegisterInGameBackDismiss } from "@/hooks/useInGameBackNavigation";
import { useTranslations } from "next-intl";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import {
  HORN_OPTIONS,
  SFX_DETAIL_OPTIONS,
  type HornId,
  type SfxDetailId,
  type SfxDetailSettings,
} from "./soundSettings";

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
  const originRef = useRef<{ x: number; y: number; value: number } | null>(
    null,
  );
  const modeRef = useRef<"pending" | "scrub" | "scroll">("pending");

  const resetPointer = () => {
    originRef.current = null;
    modeRef.current = "pending";
  };

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
        style={{ touchAction: "pan-y" }}
        onPointerDown={(e) => {
          e.stopPropagation();
          originRef.current = { x: e.clientX, y: e.clientY, value };
          modeRef.current = "pending";
        }}
        onPointerMove={(e) => {
          const origin = originRef.current;
          if (!origin || modeRef.current !== "pending") return;
          const dx = Math.abs(e.clientX - origin.x);
          const dy = Math.abs(e.clientY - origin.y);
          if (dx < 8 && dy < 8) return;
          if (dy >= dx) {
            modeRef.current = "scroll";
            if (value !== origin.value) onChange(origin.value);
            return;
          }
          modeRef.current = "scrub";
        }}
        onPointerUp={resetPointer}
        onPointerCancel={() => {
          const origin = originRef.current;
          if (
            origin &&
            modeRef.current !== "scrub" &&
            value !== origin.value
          ) {
            onChange(origin.value);
          }
          resetPointer();
        }}
        onChange={(e) => {
          if (modeRef.current === "scroll") return;
          onChange(Number(e.target.value));
        }}
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
  trailing,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: () => void;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-1.5 rounded-lg bg-white/[0.05] px-0.5 pb-1 pt-0.5">
      <div className="flex items-center justify-between gap-2 px-2.5 pb-0.5 pt-1.5">
        <h3 className="text-[11px] font-bold tracking-wide text-white">
          {title}
        </h3>
        <div className="flex items-center gap-1.5">
          {trailing}
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
      </div>
      {children}
    </section>
  );
}

function SfxSettingsModal({
  open,
  onClose,
  details,
  disabled,
  onChange,
  hornId,
  onHornIdChange,
}: {
  open: boolean;
  onClose: () => void;
  details: SfxDetailSettings;
  disabled: boolean;
  onChange: (id: SfxDetailId, next: { enabled: boolean; volume: number }) => void;
  hornId: HornId;
  onHornIdChange: (hornId: HornId) => void;
}) {
  return (
    <AppModalOverlay
      open={open}
      onClose={onClose}
      nested
      panelClassName="max-w-md bg-[#17110d] text-white"
    >
      <div className="flex max-h-[80dvh] min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h3 className="text-sm font-black">상세 효과음 설정</h3>
            <p className="mt-0.5 text-[10px] text-white/55">
              전체 효과음 볼륨에 각 항목의 볼륨이 추가로 적용됩니다.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md bg-white/10 px-2 py-1 text-xs"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
        <div
          className={`min-h-0 touch-pan-y overflow-y-auto overscroll-contain px-3 py-2 ${
            disabled ? "opacity-40" : ""
          }`}
        >
          {SFX_DETAIL_OPTIONS.map(({ id, label }) => {
            const detail = details[id];
            return (
              <div
                key={id}
                className="mb-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold">{label}</span>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-pressed={detail.enabled}
                    onClick={() =>
                      onChange(id, { ...detail, enabled: !detail.enabled })
                    }
                    className={`rounded-md px-2.5 py-1 text-[10px] font-black ${
                      detail.enabled && !disabled
                        ? "bg-sky-400/20 text-sky-300 ring-1 ring-sky-300/40"
                        : "bg-white/8 text-white/40 ring-1 ring-white/10"
                    }`}
                  >
                    {detail.enabled ? "ON" : "OFF"}
                  </button>
                </div>
                <VolumeSlider
                  value={detail.volume}
                  disabled={disabled || !detail.enabled}
                  onChange={(volume) => onChange(id, { ...detail, volume })}
                />
                {id === "horn" ? (
                  <div className="px-0.5 pb-1">
                    <select
                      value={hornId}
                      disabled={disabled || !detail.enabled}
                      onChange={(e) =>
                        onHornIdChange(Number(e.target.value) as HornId)
                      }
                      onPointerDown={(e) => e.stopPropagation()}
                      className="w-full rounded-md border border-white/15 bg-black/70 px-1.5 py-1 text-[10px] font-semibold text-white outline-none focus:border-sky-400/60 disabled:cursor-not-allowed"
                    >
                      {HORN_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </AppModalOverlay>
  );
}

function ActionRow({
  label,
  onClick,
  disabled,
  notify,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  notify?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="relative flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-white hover:bg-white/10 disabled:text-white/35"
    >
      <span>{label}</span>
      {notify ? (
        <span className="yanmar-quest-notify-badge is-dot" aria-hidden />
      ) : null}
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
  sfxDetails: SfxDetailSettings;
  onSfxDetailChange: (
    id: SfxDetailId,
    next: { enabled: boolean; volume: number },
  ) => void;
  hornId: HornId;
  onHornIdChange: (hornId: HornId) => void;
  onResetPosition?: () => void;
  onShowGuide?: () => void;
  onShowTutorial?: () => void;
  tutorialNotify?: boolean;
  onShowRanking?: () => void;
  onSaveAndExit?: () => void;
  onLogout?: () => void;
  /** ADMIN only — show 「관리」 under 고객문의 */
  isAdmin?: boolean;
  /** Called before navigating to /admin (e.g. persist session). */
  onBeforeOpenAdmin?: () => void;
}

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
  breakerSfxEnabled: _breakerSfxEnabled,
  onToggleBreakerSfx: _onToggleBreakerSfx,
  sfxDetails,
  onSfxDetailChange,
  hornId,
  onHornIdChange,
  onResetPosition,
  onShowGuide,
  onShowTutorial,
  tutorialNotify = false,
  onShowRanking,
  onSaveAndExit,
  onLogout,
  isAdmin = false,
  onBeforeOpenAdmin,
}: YanmarGameSettingsMenuProps) {
  void _breakerSfxEnabled;
  void _onToggleBreakerSfx;
  const t = useTranslations("yanmar.settings");
  const common = useTranslations("common");
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
  const [sfxSettingsOpen, setSfxSettingsOpen] = useState(false);
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
      aria-label={t("title")}
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
        {(["display", "sound", "other"] as const).map((id) => {
          const item = { id, label: t(id) };
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
            <LanguagePicker variant="game" />
            <ToggleRow label={t("minimap")} on={showMinimap} onToggle={onToggleMinimap} />
            <ToggleRow
              label={t("missionQuest")}
              on={showMissionQuest}
              onToggle={onToggleMissionQuest}
            />
          </>
        ) : null}

        {tab === "sound" ? (
          <>
            <SoundSection title={t("bgm")} enabled={bgmEnabled} onToggle={onToggleBgm}>
              <VolumeSlider
                value={bgmVolume}
                onChange={onBgmVolumeChange}
                disabled={!bgmEnabled}
              />
            </SoundSection>

            <SoundSection
              title={t("sfx")}
              enabled={sfxEnabled}
              onToggle={onToggleSfx}
              trailing={
                <button
                  type="button"
                  onClick={() => setSfxSettingsOpen(true)}
                  className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-bold text-white/75 hover:bg-white/10"
                >
                  {t("detailedSettings")}
                </button>
              }
            >
              <VolumeSlider
                value={sfxVolume}
                onChange={onSfxVolumeChange}
                disabled={!sfxEnabled}
              />
            </SoundSection>
          </>
        ) : null}

        {tab === "other" ? (
          <>
            {onResetPosition ? (
              <ActionRow
                label={t("resetPosition")}
                onClick={() => {
                  onOpenChange(false);
                  onResetPosition();
                }}
              />
            ) : null}
            {canFullscreen && !inApiFullscreen && !isStandalone ? (
              <ActionRow
                label={t("fullscreen")}
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
              label={t("mailbox")}
              onClick={() => {
                onOpenChange(false);
                setMailboxOpen(true);
              }}
            />
            <ActionRow
              label={t("inventory")}
              onClick={() => {
                onOpenChange(false);
                setInventoryOpen(true);
              }}
            />
            <ActionRow
              label={t("guide")}
              onClick={() => {
                onOpenChange(false);
                onShowGuide?.();
              }}
              disabled={!onShowGuide}
            />
            <ActionRow
              label={t("tutorial")}
              onClick={() => {
                onOpenChange(false);
                onShowTutorial?.();
              }}
              disabled={!onShowTutorial}
              notify={tutorialNotify}
            />
            <ActionRow
              label={t("ranking")}
              onClick={() => {
                onOpenChange(false);
                onShowRanking?.();
              }}
              disabled={!onShowRanking}
            />
            <ActionRow
              label={t("inquiry")}
              onClick={() => {
                onOpenChange(false);
                setInquiryOpen(true);
              }}
            />
            {isAdmin ? (
              <ActionRow
                label={t("admin")}
                onClick={() => {
                  onOpenChange(false);
                  onBeforeOpenAdmin?.();
                  markResumeInGame();
                  // Don't await leave — exitFullscreen can hang and block navigation.
                  void immersiveFullscreen?.leave();
                  void exitFullscreen();
                  disablePwaMode();
                  window.location.assign("/admin");
                }}
              />
            ) : null}
            {onLogout ? (
              <ActionRow
                label={t("logout")}
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
            {t("saveAndExit")}
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
          aria-label={common("close")}
          onClick={() => onOpenChange(false)}
        />
        {panelBody}
      </div>
    ) : (
      <>
        <button
          type="button"
          className="fixed inset-0 z-[400] cursor-default"
          aria-label={common("close")}
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
        className={`relative yanmar-settings-menu-trigger${open ? " is-open" : ""}`}
        aria-label={t("title")}
        aria-expanded={open}
      >
        <span className="yanmar-settings-menu-trigger-glyph" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" className="yanmar-settings-menu-trigger-svg">
            <path
              d="M4.5 7.25h15M4.5 12h15M4.5 16.75h15"
              stroke="currentColor"
              strokeWidth="2.15"
              strokeLinecap="round"
            />
          </svg>
        </span>
        {tutorialNotify ? (
          <span className="yanmar-quest-notify-badge is-dot" aria-hidden />
        ) : null}
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
      <SfxSettingsModal
        open={sfxSettingsOpen}
        onClose={() => setSfxSettingsOpen(false)}
        details={sfxDetails}
        disabled={!sfxEnabled}
        onChange={onSfxDetailChange}
        hornId={hornId}
        onHornIdChange={onHornIdChange}
      />
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
