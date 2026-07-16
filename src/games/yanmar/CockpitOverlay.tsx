"use client";

/* eslint-disable react-hooks/immutability */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AuxiliaryControlState,
  ControlMask,
  ExcavatorControlState,
} from "./controls";
import {
  BLADE_LOWERED,
  BLADE_RAISED,
  BLADE_SPEED_PER_SECOND,
  COCKPIT_LAYOUT,
} from "./controls";
import type { GameMode, TutorialStep } from "./tutorial";
import type { AttachmentType, AutoPoseSlotIndex, AutoPoseState } from "./types";
import { AUTO_POSE_SLOT_COUNT } from "./types";
import {
  AUTO_POSE_LABEL_MAX_CHARS,
  AUTO_POSE_LABEL_MIN_CHARS,
  countAutoPoseLabelChars,
  defaultAutoPoseSlotLabels,
  type AutoPoseSlotLabels,
} from "./autoPosePersistence";
import {
  getAttachmentRequiredLevel,
  isAttachmentUnlocked,
} from "@/lib/playerUnlocks";
import type { HornId } from "./soundSettings";
import { yanmarAudio } from "./yanmarAudio";

interface CockpitOverlayProps {
  mode: GameMode;
  input: ExcavatorControlState;
  onInputChange: (
    input:
      | ExcavatorControlState
      | ((current: ExcavatorControlState) => ExcavatorControlState),
  ) => void;
  auxiliary: AuxiliaryControlState;
  onAuxiliaryChange: (
    input:
      | AuxiliaryControlState
      | ((current: AuxiliaryControlState) => AuxiliaryControlState),
  ) => void;
  allowed: ControlMask;
  tutorialStep: TutorialStep | null;
  showTouchZones: boolean;
  hideVisualDeck?: boolean;
  autoPose: AutoPoseState;
  autoPoseLabels: AutoPoseSlotLabels;
  onSavePose: (slot: AutoPoseSlotIndex) => void;
  onExecutePose: (slot: AutoPoseSlotIndex) => void;
  onSaveAutoPoseLabels: (labels: AutoPoseSlotLabels) => void;
  savePoseDisabled?: boolean;
  executePoseDisabled?: boolean;
  attachmentType: AttachmentType;
  playerLevel: number;
  /** 연습·튜토리얼: 레벨 제한 없이 모든 부착물 사용 */
  unlockAllAttachments?: boolean;
  onAttachmentChange: (attachment: AttachmentType) => void;
  onAttachmentWarning?: (message: string) => void;
  hornId?: HornId;
  onHorn?: () => void;
}

interface JoystickLayout {
  cx: number;
  cy: number;
  radius: number;
  travel: number;
}

const PEDAL_SWING_SPEED_PER_SECOND = 0.85;

function getJoystickZoneMetrics(isPortrait: boolean) {
  return {
    centerYOffset: isPortrait ? 0.095 : 0.08,
    width: isPortrait ? "15.5%" : "13.2%",
    height: isPortrait ? "34%" : "54%",
    heightHalfPct: isPortrait ? 17 : 27,
  };
}

/** 인게임 D-pad 크기 — GameJoystick / MainDPadVisual 과 동일 */
const DPAD_SIZE = "clamp(6.2rem, 30vw, 8.4rem)";
/** 하단 여유를 둬 프레임 overflow에 잘리지 않게 */
const DPAD_BOTTOM = "calc(0.28rem - var(--yanmar-controls-sink, 0rem))";
/** 좌·우 끝 붙임 (살짝만 안쪽) */
const DPAD_EDGE = "0.2rem";

function getAuxMenuButtonSize(isPortrait: boolean) {
  return isPortrait ? "2.85rem" : "2.75rem";
}

/** 좌·우 보조 메뉴 토글 공통 높이 (기능 / 자동) */
const AUX_MENU_TOGGLE_CY = 0.495;
/** 경적 ↔ 자동 버튼 간격 */
const HORN_AUTO_GAP = "0.42rem";

/** `as const` layout literals widened so portrait offsets type-check. */
type WidenNumbers<T> = T extends number
  ? number
  : T extends object
    ? { -readonly [K in keyof T]: WidenNumbers<T[K]> }
    : T;
type CockpitLayout = WidenNumbers<typeof COCKPIT_LAYOUT>;

const PORTRAIT_COCKPIT_LAYOUT: CockpitLayout = {
  ...COCKPIT_LAYOUT,
  left: { ...COCKPIT_LAYOUT.left, cx: 0.1, cy: 0.965 },
  right: { ...COCKPIT_LAYOUT.right, cx: 0.9, cy: 0.965 },
  safetyLever: { ...COCKPIT_LAYOUT.safetyLever, cx: 0.1, cy: 0.385 },
  travelLeft: { ...COCKPIT_LAYOUT.travelLeft, cx: 0.453, cy: 0.79 },
  travelRight: { ...COCKPIT_LAYOUT.travelRight, cx: 0.548, cy: 0.79 },
  travelBoth: { ...COCKPIT_LAYOUT.travelBoth, cx: 0.5, cy: 0.79 },
  // Under travel levers — clearly separated L/R foot pedals.
  rightPedal: { ...COCKPIT_LAYOUT.rightPedal, cx: 0.595, cy: 0.92 },
  breakerPedal: { ...COCKPIT_LAYOUT.breakerPedal, cx: 0.405, cy: 0.92 },
  hydraulicSpeed: { ...COCKPIT_LAYOUT.hydraulicSpeed, cx: 0.1, cy: 0.275 },
  blade: { ...COCKPIT_LAYOUT.blade, cx: 0.1, cy: 0.165 },
  horn: { ...COCKPIT_LAYOUT.horn, cx: 0.9, cy: 0.495 },
};

const FUNCTION_MENU_OPEN_DELAYS_MS = {
  safety: 0,
  rpm: 50,
  blade: 100,
} as const;
const FUNCTION_MENU_CLOSE_DELAYS_MS = {
  blade: 0,
  rpm: 35,
  safety: 70,
} as const;

/** Travel levers sit above the dual foot-pedal row. */
const TRAVEL_BASELINE =
  "calc(100% - var(--yanmar-travel-baseline, 4.55rem))";
const FOOT_PEDAL_BASELINE =
  "calc(100% - var(--yanmar-foot-pedal-baseline, 1.35rem))";

const AUTO_POSE_SLOT_ORDER = Array.from(
  { length: AUTO_POSE_SLOT_COUNT },
  (_, i) => i as AutoPoseSlotIndex,
);

function VisualJoystick({
  side,
  value,
  highlighted,
  layout,
  isPortrait = false,
}: {
  side: "left" | "right";
  value: { x: number; y: number };
  highlighted: boolean;
  layout: CockpitLayout;
  isPortrait?: boolean;
}) {
  const x = Math.max(-1, Math.min(1, value.x));
  const y = Math.max(-1, Math.min(1, value.y));
  const visualX = side === "right" ? -x : x;
  const visualY = side === "right" ? -y : y;
  const tiltX = side === "left" ? visualX : -visualX;
  const pullDepth = Math.max(0, -y);
  const pushDepth = Math.max(0, y);
  const stickDrop = pullDepth * 0.42 - pushDepth * 0.22;
  const bootDrop = pullDepth * 0.18 - pushDepth * 0.12;
  const bootScaleY = 1 - pullDepth * 0.08 + pushDepth * 0.08;
  const centerYOffset = isPortrait ? 0.095 : 0.08;
  return (
    <div
      className={`yanmar-visual-part yanmar-visual-joystick yanmar-visual-joystick-${side} ${
        highlighted ? "yanmar-visual-highlight" : ""
      }`}
      style={{
        left: `${layout[side].cx * 100}%`,
        top: `${(layout[side].cy - centerYOffset) * 100}%`,
      }}
    >
      <div className="yanmar-realstick">
        <div className="yanmar-realstick-shadow" aria-hidden />
        <div className="yanmar-realstick-base">
          <span className="yanmar-realstick-base-plate" />
          <span className="yanmar-realstick-base-led" />
        </div>
        <div
          className="yanmar-realstick-boot"
          style={{
            transform: `translate3d(-50%, ${bootDrop}rem, 0) rotate(${tiltX * 3.5}deg) scaleY(${bootScaleY})`,
          }}
        >
          <span className="yanmar-realstick-boot-ring ring-1" />
          <span className="yanmar-realstick-boot-ring ring-2" />
          <span className="yanmar-realstick-boot-ring ring-3" />
          <span className="yanmar-realstick-boot-ring ring-4" />
          <span className="yanmar-realstick-boot-ring ring-5" />
        </div>
        <div
          className="yanmar-realstick-upper"
          style={{
            transform: `translate3d(-50%, ${stickDrop}rem, 0) rotate(${tiltX * 12}deg) skewX(${visualY * -2}deg)`,
          }}
        >
          <span className="yanmar-realstick-stem" />
          <span className="yanmar-realstick-collar">
            <span className="yanmar-realstick-collar-bolt bolt-left" />
            <span className="yanmar-realstick-collar-bolt bolt-right" />
          </span>
          <span className="yanmar-realstick-grip">
            <span className="yanmar-realstick-grip-knurl" />
            <span className="yanmar-realstick-cap" />
            <span className="yanmar-realstick-face" />
            <span className="yanmar-realstick-side" />
            <span className="yanmar-realstick-ring yanmar-realstick-ring-1" />
            <span className="yanmar-realstick-ring yanmar-realstick-ring-2" />
            <span className="yanmar-realstick-ring yanmar-realstick-ring-3" />
            <span className="yanmar-realstick-label">{side === "left" ? "L" : "R"}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function VisualLever({
  cx,
  cy,
  value,
  color = "dark",
  highlighted = false,
  variant,
  compact = false,
}: {
  cx: number;
  cy: number | string;
  value: number;
  color?: "dark" | "red" | "blue";
  highlighted?: boolean;
  variant?: "safety" | "hydraulic" | "travel";
  /** Portrait side-panel levers: keep throw inside the square frame */
  compact?: boolean;
}) {
  const v = Math.max(-1, Math.min(1, value));
  const pullDepth = Math.max(0, -v);
  const pushDepth = Math.max(0, v);
  const isTravel = variant === "travel";
  const stickDrop = compact
    ? pullDepth * 0.1 - pushDepth * 0.04
    : pullDepth * 0.42 - pushDepth * 0.12;
  const bendX = compact
    ? v >= 0
      ? v * -6
      : v * -10
    : isTravel
      ? pushDepth * -30 + pullDepth * 44
      : v >= 0
        ? v * -22
        : v * -48;
  // Keep the stick root inside the lever lane when pulled/pushed.
  const travelPivotThrowRem = 0.3;
  // Pull (후진/당김): stick leans toward camera, knob folds further downward.
  const travelStickTiltX = -12 - pushDepth * 8 + pullDepth * 58;
  const travelHeadTiltX = 10 - pushDepth * 4 - pullDepth * 68;
  const travelHeadDrop = pullDepth * 0.14 - pushDepth * 0.04;
  const motionClass = v > 0.16 ? "is-pushed" : v < -0.16 ? "is-pulled" : "is-neutral";
  const stickTransform = isTravel
    ? `translate3d(-50%, 0, 0.22rem) rotateX(${travelStickTiltX}deg)`
    : `translate3d(-50%, ${stickDrop}rem, 0) rotateX(${bendX}deg)`;
  const pivotTransform = isTravel
    ? `translate3d(-50%, calc(-50% + ${v * -travelPivotThrowRem}rem), -0.12rem) rotateX(12deg)`
    : undefined;
  return (
    <div
      className={`yanmar-visual-part yanmar-visual-lever ${
        highlighted ? "yanmar-visual-highlight" : ""
      } ${variant === "safety" ? "yanmar-visual-lever-safety" : ""} ${
        variant === "hydraulic" ? "yanmar-visual-lever-hydraulic" : ""
      } ${variant === "travel" ? "yanmar-visual-lever-travel" : ""} ${
        compact ? "yanmar-visual-lever-compact" : ""
      } ${motionClass}`}
      style={
        compact
          ? undefined
          : {
              left: `${cx * 100}%`,
              top: typeof cy === "number" ? `${cy * 100}%` : cy,
            }
      }
    >
      {isTravel ? (
        <div className="yanmar-premium-lever-panel" aria-hidden>
          <span className="yanmar-premium-lever-panel-inset" />
          <span className="yanmar-premium-lever-status is-forward" />
          <span className="yanmar-premium-lever-status is-reverse" />
          <span className="yanmar-premium-lever-bolt bolt-tl" />
          <span className="yanmar-premium-lever-bolt bolt-tr" />
          <span className="yanmar-premium-lever-bolt bolt-bl" />
          <span className="yanmar-premium-lever-bolt bolt-br" />
        </div>
      ) : null}
      <div className="yanmar-lever-mount" />
      <div className="yanmar-lever-slot" />
      <div
        className="yanmar-lever-pivot"
        style={pivotTransform ? { transform: pivotTransform } : undefined}
      >
        <div
          className={`yanmar-lever-stick yanmar-lever-${color}`}
          style={{
            transform: stickTransform,
            ...(isTravel
              ? {
                  height: "var(--yanmar-travel-stick-h, 2.45rem)",
                }
              : null),
          }}
        >
          <span
            style={
              isTravel
                ? {
                    transform: `translateX(-50%) translateY(${travelHeadDrop}rem) translateZ(0.12rem) perspective(5rem) rotateX(${travelHeadTiltX}deg)`,
                    transformOrigin: "50% 92%",
                  }
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}

function VisualTravelLevers({
  left,
  right,
  highlighted,
  layout,
}: {
  left: number;
  right: number;
  highlighted: boolean;
  layout: CockpitLayout;
}) {
  return (
    <div className="yanmar-travel-cluster">
      <div
        className="yanmar-premium-dual-travel-panel"
        style={{
          left: `${layout.travelBoth.cx * 100}%`,
          top: TRAVEL_BASELINE,
        }}
        aria-hidden
      >
        <span className="yanmar-premium-dual-travel-inset" />
        <span className="yanmar-premium-dual-travel-lane is-left" />
        <span className="yanmar-premium-dual-travel-lane is-right" />
        <span className="yanmar-premium-dual-travel-divider" />
        <span className="yanmar-premium-lever-bolt bolt-tl" />
        <span className="yanmar-premium-lever-bolt bolt-tr" />
        <span className="yanmar-premium-lever-bolt bolt-bl" />
        <span className="yanmar-premium-lever-bolt bolt-br" />
      </div>
      <VisualLever
        cx={layout.travelLeft.cx}
        cy={TRAVEL_BASELINE}
        value={left}
        color="dark"
        highlighted={highlighted}
        variant="travel"
      />
      <VisualLever
        cx={layout.travelRight.cx}
        cy={TRAVEL_BASELINE}
        value={right}
        color="dark"
        highlighted={highlighted}
        variant="travel"
      />
    </div>
  );
}

function PremiumFootPedalArt({
  accent = "amber",
  leftActive = false,
  rightActive = false,
}: {
  accent?: "amber" | "cyan";
  leftActive?: boolean;
  rightActive?: boolean;
}) {
  return (
    <div
      className={`yanmar-premium-foot-pedal-art yanmar-premium-foot-pedal-art-${accent} pointer-events-none`}
      aria-hidden
    >
      <span className="yanmar-premium-foot-pedal-bay">
        <span className="yanmar-premium-foot-pedal-inset" />
        <span className="yanmar-premium-lever-bolt bolt-tl" />
        <span className="yanmar-premium-lever-bolt bolt-tr" />
        <span className="yanmar-premium-lever-bolt bolt-bl" />
        <span className="yanmar-premium-lever-bolt bolt-br" />
        <span className="yanmar-premium-foot-pedal-hinge" />
        <span
          className={`yanmar-premium-foot-pedal-rocker ${
            leftActive ? "is-left-active" : rightActive ? "is-right-active" : ""
          }`}
        >
          <span className="yanmar-premium-foot-pedal-half is-left">
            <span className="yanmar-premium-foot-pedal-tread" />
          </span>
          <span className="yanmar-premium-foot-pedal-spine" />
          <span className="yanmar-premium-foot-pedal-half is-right">
            <span className="yanmar-premium-foot-pedal-tread" />
          </span>
        </span>
      </span>
    </div>
  );
}

function VisualSafetyLockStatus({ locked, cx, cy }: { locked: boolean; cx: number; cy: number }) {
  return (
    <div
      className={`yanmar-safety-lock-status ${locked ? "is-locked" : "is-unlocked"}`}
      style={{
        left: `${cx * 100}%`,
        top: `${(cy + 0.13) * 100}%`,
      }}
    >
      <span>{locked ? "잠김" : "해제"}</span>
    </div>
  );
}

function VisualHydraulicSpeedStatus({
  highSpeed,
  cx,
  cy,
}: {
  highSpeed: boolean;
  cx: number;
  cy: number;
}) {
  return (
    <div
      className={`yanmar-hydraulic-speed-status ${highSpeed ? "is-high" : "is-low"}`}
      style={{
        left: `${cx * 100}%`,
        top: `${(cy + 0.13) * 100}%`,
      }}
    >
      {highSpeed ? "x2" : "x1"}
    </div>
  );
}

function MainDPadVisual({
  side,
  value,
  layout,
  isPortrait,
  screenOverlay = false,
}: {
  side: "left" | "right";
  value: { x: number; y: number };
  layout: JoystickLayout;
  isPortrait: boolean;
  screenOverlay?: boolean;
}) {
  const centerYOffset = isPortrait ? 0.095 : 0.08;
  const accent = side === "left" ? "#38bdf8" : "#fbbf24";
  const active = {
    up: value.y > 0.5,
    right: value.x > 0.5,
    down: value.y < -0.5,
    left: value.x < -0.5,
  };
  return (
    <div
      className={`yanmar-main-dpad-${side}`}
      style={
        screenOverlay
          ? {
              position: "absolute",
              left: side === "left" ? DPAD_EDGE : "auto",
              right: side === "right" ? DPAD_EDGE : "auto",
              top: "auto",
              bottom: DPAD_BOTTOM,
              width: DPAD_SIZE,
              aspectRatio: "1",
              transform: "translate3d(0, 0, 0)",
              zIndex: 70,
              pointerEvents: "none",
              filter: "drop-shadow(0 8px 6px rgba(2, 6, 23, 0.55))",
              overflow: "visible",
            }
          : {
              position: "absolute",
              left: `${layout.cx * 100}%`,
              top: `${(layout.cy - centerYOffset) * 100}%`,
              width: DPAD_SIZE,
              aspectRatio: "1",
              transform: "translate3d(-50%, -50%, 0)",
              zIndex: 70,
              pointerEvents: "none",
              overflow: "visible",
            }
      }
      aria-hidden
    >
      <svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        role="presentation"
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id={`dpad-shell-${side}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#94a3b8" />
            <stop offset="0.32" stopColor="#475569" />
            <stop offset="0.7" stopColor="#111827" />
            <stop offset="1" stopColor="#020617" />
          </linearGradient>
          <linearGradient id={`dpad-key-${side}`} x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="#a8b4c3" />
            <stop offset="0.16" stopColor="#64748b" />
            <stop offset="0.48" stopColor="#334155" />
            <stop offset="0.76" stopColor="#111827" />
            <stop offset="1" stopColor="#080d14" />
          </linearGradient>
          <radialGradient id={`dpad-active-${side}`}>
            <stop offset="0" stopColor={accent} stopOpacity="0.9" />
            <stop offset="0.58" stopColor={accent} stopOpacity="0.45" />
            <stop offset="1" stopColor="#0f172a" />
          </radialGradient>
          <radialGradient id={`dpad-center-${side}`} cx="35%" cy="28%">
            <stop offset="0" stopColor="#64748b" />
            <stop offset="0.46" stopColor="#1e293b" />
            <stop offset="1" stopColor="#020617" />
          </radialGradient>
          <filter id={`dpad-shadow-${side}`} x="-30%" y="-30%" width="160%" height="180%">
            <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#020617" floodOpacity="0.85" />
          </filter>
          <filter id={`dpad-glow-${side}`} x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={accent} floodOpacity="0.85" />
          </filter>
        </defs>

        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="27"
          fill={`url(#dpad-shell-${side})`}
          stroke="#cbd5e1"
          strokeOpacity="0.58"
          strokeWidth="1.4"
          filter={`url(#dpad-shadow-${side})`}
        />
        <rect
          x="8"
          y="8"
          width="84"
          height="84"
          rx="23"
          fill="none"
          stroke={accent}
          strokeOpacity="0.42"
          strokeWidth="1"
        />

        <g
          fill={active.up ? `url(#dpad-active-${side})` : `url(#dpad-key-${side})`}
          stroke={active.up ? accent : "#94a3b8"}
          strokeWidth={active.up ? "1.8" : "1"}
          filter={active.up ? `url(#dpad-glow-${side})` : undefined}
          transform={active.up ? "translate(0 2)" : undefined}
        >
          <path d="M50 11 Q52 11 54 13 L65 24 Q67 26 67 29 V40 Q67 43 64 43 H36 Q33 43 33 40 V29 Q33 26 35 24 L46 13 Q48 11 50 11 Z" fill="#020617" stroke="#020617" transform="translate(0 3)" />
          <path d="M50 11 Q52 11 54 13 L65 24 Q67 26 67 29 V40 Q67 43 64 43 H36 Q33 43 33 40 V29 Q33 26 35 24 L46 13 Q48 11 50 11 Z" />
          <path d="M50 13 L64 28" fill="none" stroke="#fff" strokeOpacity="0.34" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M35 40 H65" fill="none" stroke="#020617" strokeOpacity="0.72" strokeWidth="1.5" strokeLinecap="round" />
        </g>
        <g
          fill={active.right ? `url(#dpad-active-${side})` : `url(#dpad-key-${side})`}
          stroke={active.right ? accent : "#94a3b8"}
          strokeWidth={active.right ? "1.8" : "1"}
          filter={active.right ? `url(#dpad-glow-${side})` : undefined}
          transform={active.right ? "translate(0 2)" : undefined}
        >
          <path d="M60 33 H71 Q74 33 76 35 L87 46 Q89 48 89 50 Q89 52 87 54 L76 65 Q74 67 71 67 H60 Q57 67 57 64 V36 Q57 33 60 33 Z" fill="#020617" stroke="#020617" transform="translate(0 3)" />
          <path d="M60 33 H71 Q74 33 76 35 L87 46 Q89 48 89 50 Q89 52 87 54 L76 65 Q74 67 71 67 H60 Q57 67 57 64 V36 Q57 33 60 33 Z" />
          <path d="M60 35 H72 L86 49" fill="none" stroke="#fff" strokeOpacity="0.32" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M59 64 H72" fill="none" stroke="#020617" strokeOpacity="0.72" strokeWidth="1.5" strokeLinecap="round" />
        </g>
        <g
          fill={active.down ? `url(#dpad-active-${side})` : `url(#dpad-key-${side})`}
          stroke={active.down ? accent : "#94a3b8"}
          strokeWidth={active.down ? "1.8" : "1"}
          filter={active.down ? `url(#dpad-glow-${side})` : undefined}
          transform={active.down ? "translate(0 2)" : undefined}
        >
          <path d="M36 57 H64 Q67 57 67 60 V71 Q67 74 65 76 L54 87 Q52 89 50 89 Q48 89 46 87 L35 76 Q33 74 33 71 V60 Q33 57 36 57 Z" fill="#020617" stroke="#020617" transform="translate(0 3)" />
          <path d="M36 57 H64 Q67 57 67 60 V71 Q67 74 65 76 L54 87 Q52 89 50 89 Q48 89 46 87 L35 76 Q33 74 33 71 V60 Q33 57 36 57 Z" />
          <path d="M35 59 H65" fill="none" stroke="#fff" strokeOpacity="0.32" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M35 72 L50 87 L65 72" fill="none" stroke="#020617" strokeOpacity="0.72" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g
          fill={active.left ? `url(#dpad-active-${side})` : `url(#dpad-key-${side})`}
          stroke={active.left ? accent : "#94a3b8"}
          strokeWidth={active.left ? "1.8" : "1"}
          filter={active.left ? `url(#dpad-glow-${side})` : undefined}
          transform={active.left ? "translate(0 2)" : undefined}
        >
          <path d="M11 50 Q11 48 13 46 L24 35 Q26 33 29 33 H40 Q43 33 43 36 V64 Q43 67 40 67 H29 Q26 67 24 65 L13 54 Q11 52 11 50 Z" fill="#020617" stroke="#020617" transform="translate(0 3)" />
          <path d="M11 50 Q11 48 13 46 L24 35 Q26 33 29 33 H40 Q43 33 43 36 V64 Q43 67 40 67 H29 Q26 67 24 65 L13 54 Q11 52 11 50 Z" />
          <path d="M13 49 L28 35 H40" fill="none" stroke="#fff" strokeOpacity="0.32" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M28 64 H40" fill="none" stroke="#020617" strokeOpacity="0.72" strokeWidth="1.5" strokeLinecap="round" />
        </g>

        <g transform={active.up ? "translate(0 2)" : undefined}>
          <path d="M44 27 L50 21 L56 27" fill="none" stroke="#020617" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.82" transform="translate(0 1.5)" />
          <path d="M44 27 L50 21 L56 27" fill="none" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.94" />
        </g>
        <g transform={active.right ? "translate(0 2)" : undefined}>
          <path d="M73 44 L79 50 L73 56" fill="none" stroke="#020617" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.82" transform="translate(0 1.5)" />
          <path d="M73 44 L79 50 L73 56" fill="none" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.94" />
        </g>
        <g transform={active.down ? "translate(0 2)" : undefined}>
          <path d="M44 73 L50 79 L56 73" fill="none" stroke="#020617" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.82" transform="translate(0 1.5)" />
          <path d="M44 73 L50 79 L56 73" fill="none" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.94" />
        </g>
        <g transform={active.left ? "translate(0 2)" : undefined}>
          <path d="M27 44 L21 50 L27 56" fill="none" stroke="#020617" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.82" transform="translate(0 1.5)" />
          <path d="M27 44 L21 50 L27 56" fill="none" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.94" />
        </g>

        <circle
          cx="50"
          cy="50"
          r="15"
          fill={`url(#dpad-center-${side})`}
          stroke="#020617"
          strokeWidth="5"
        />
        <circle
          cx="50"
          cy="50"
          r="13.5"
          fill="none"
          stroke={accent}
          strokeOpacity="0.82"
          strokeWidth="1.5"
        />
        <circle cx="50" cy="50" r="4.2" fill={accent} opacity="0.9" />
        <circle cx="48.7" cy="48.7" r="1.3" fill="#fff" opacity="0.65" />
      </svg>
    </div>
  );
}

function VisualControlDeck({
  input,
  highlightLeft,
  highlightRight,
  highlightTravel,
  layout,
  isPortrait,
  useDPad,
}: {
  input: ExcavatorControlState;
  highlightLeft: boolean;
  highlightRight: boolean;
  highlightTravel: boolean;
  layout: CockpitLayout;
  isPortrait: boolean;
  useDPad: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {!useDPad ? (
        <div className="yanmar-control-rail">
          <div className="yanmar-deck-brand-badge">YANMAR</div>
          <div className="yanmar-deck-instrument-strip" />
          <div className="yanmar-bottom-connector" />
        </div>
      ) : null}
      {!useDPad ? (
        <VisualJoystick side="left" value={input.left} highlighted={highlightLeft} layout={layout} isPortrait={isPortrait} />
      ) : null}
      <VisualTravelLevers
        left={input.travel.left}
        right={input.travel.right}
        highlighted={highlightTravel}
        layout={layout}
      />
      {!useDPad ? (
        <VisualJoystick side="right" value={input.right} highlighted={highlightRight} layout={layout} isPortrait={isPortrait} />
      ) : null}
    </div>
  );
}

function usePointerRelease(onRelease: () => void) {
  const pointerIdRef = useRef<number | null>(null);
  const dragging = useRef(false);
  const captureElRef = useRef<HTMLElement | null>(null);
  const onReleaseRef = useRef(onRelease);
  onReleaseRef.current = onRelease;

  const finish = useCallback((pointerId?: number) => {
    if (
      pointerId != null &&
      pointerIdRef.current != null &&
      pointerIdRef.current !== pointerId
    ) {
      return;
    }
    if (!dragging.current) return;
    const el = captureElRef.current;
    const pid = pointerIdRef.current;
    dragging.current = false;
    pointerIdRef.current = null;
    captureElRef.current = null;
    if (el && pid != null) {
      try {
        if (el.hasPointerCapture(pid)) el.releasePointerCapture(pid);
      } catch {
        /* already released */
      }
    }
    onReleaseRef.current();
  }, []);

  const begin = useCallback((pointerId: number, el: HTMLElement | null) => {
    dragging.current = true;
    pointerIdRef.current = pointerId;
    captureElRef.current = el;
    try {
      el?.setPointerCapture(pointerId);
    } catch {
      /* capture optional — window pointerup still ends the drag */
    }
  }, []);

  useEffect(() => {
    const onUp = (e: PointerEvent) => finish(e.pointerId);
    const onBlur = () => finish();
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [finish]);

  return { pointerIdRef, dragging, begin, finish, onRelease };
}

const TRAVEL_INPUT_DEADZONE = 0.2;

/** 주행 드래그(다른 손가락) 중에도 토글/경적이 동작하도록 pointerdown으로 처리 */
function activateOnPointerDown(handler: () => void) {
  return (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    handler();
  };
}

function travelAxisFromClientY(zone: HTMLElement, clientY: number) {
  const rect = zone.getBoundingClientRect();
  const cy = rect.top + rect.height / 2;
  const maxR = Math.max(rect.height / 2, 1);
  const dy = Math.max(-maxR, Math.min(maxR, clientY - cy));
  const raw = Math.max(-1, Math.min(1, -dy / maxR));
  return Math.abs(raw) < TRAVEL_INPUT_DEADZONE ? 0 : raw;
}

interface GameJoystickProps {
  side: "left" | "right";
  layout: JoystickLayout;
  enabled: { x: boolean; y: boolean };
  highlighted: boolean;
  showTouchZone: boolean;
  isPortrait: boolean;
  useDPad: boolean;
  onChange: (x: number, y: number) => void;
  /** 드래그 중인 pointerId — 같은 손가락의 버튼 오입력만 걸러낼 때 사용 */
  onControlPointerDrag?: (pointerId: number, active: boolean) => void;
}

function GameJoystick({
  side,
  layout,
  enabled,
  highlighted,
  showTouchZone,
  isPortrait,
  useDPad,
  onChange,
  onControlPointerDrag,
}: GameJoystickProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const dragActiveRef = useRef(false);

  const releaseStick = useCallback(() => {
    const pid = activePointerIdRef.current;
    const wasDragging = dragActiveRef.current;
    activePointerIdRef.current = null;
    dragActiveRef.current = false;
    if (pid != null && wasDragging) onControlPointerDrag?.(pid, false);
    if (wasDragging) onChange(0, 0);
  }, [onChange, onControlPointerDrag]);
  const pointer = usePointerRelease(releaseStick);
  const joystickZone = getJoystickZoneMetrics(isPortrait);

  const updateFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const zone = zoneRef.current;
      if (!zone) return;
      const rect = zone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const halfW = rect.width / 2;
      const halfH = rect.height / 2;
      const dx = Math.max(-halfW, Math.min(halfW, clientX - cx));
      const dy = Math.max(-halfH, Math.min(halfH, clientY - cy));
      const dPadRadius = Math.min(halfW, halfH);
      const rawX = enabled.x ? dx / (useDPad ? dPadRadius : halfW) : 0;
      const rawY = enabled.y ? -dy / (useDPad ? dPadRadius : halfH) : 0;
      const useX = Math.abs(rawX) >= Math.abs(rawY);
      const axisValue = useX ? rawX : rawY;
      const digitalValue =
        Math.abs(axisValue) < 0.18 ? 0 : axisValue > 0 ? 1 : -1;
      const nx = useX ? (useDPad ? digitalValue : rawX) : 0;
      const ny = useX ? 0 : useDPad ? digitalValue : rawY;
      onChange(nx, ny);
    },
    [enabled.x, enabled.y, onChange, useDPad],
  );

  const handleStart = (e: React.PointerEvent) => {
    if (!enabled.x && !enabled.y) return;
    e.preventDefault();
    activePointerIdRef.current = e.pointerId;
    dragActiveRef.current = true;
    onControlPointerDrag?.(e.pointerId, true);
    pointer.begin(e.pointerId, zoneRef.current);
    updateFromEvent(e.clientX, e.clientY);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!pointer.dragging.current || pointer.pointerIdRef.current !== e.pointerId) {
      return;
    }
    if (!enabled.x && !enabled.y) return;
    updateFromEvent(e.clientX, e.clientY);
  };

  const handleEnd = (e: React.PointerEvent) => {
    if (pointer.pointerIdRef.current !== e.pointerId) return;
    pointer.finish(e.pointerId);
  };

  const isDisabled = !enabled.x && !enabled.y;

  return (
    <>
      <div
        ref={zoneRef}
        className={`absolute z-[62] touch-none rounded-2xl ${isDisabled ? "pointer-events-none" : "pointer-events-auto"}`}
        style={{
          left: useDPad
            ? side === "left"
              ? DPAD_EDGE
              : "auto"
            : `${layout.cx * 100}%`,
          right: useDPad && side === "right" ? DPAD_EDGE : "auto",
          top: useDPad ? "auto" : `${(layout.cy - joystickZone.centerYOffset) * 100}%`,
          bottom: useDPad ? DPAD_BOTTOM : "auto",
          width: useDPad ? DPAD_SIZE : joystickZone.width,
          height: useDPad ? DPAD_SIZE : joystickZone.height,
          transform: useDPad ? "none" : "translate(-50%, -50%)",
        }}
        onPointerDown={handleStart}
        onPointerMove={handleMove}
        onPointerUp={handleEnd}
        onPointerCancel={handleEnd}
        onLostPointerCapture={() => {
          pointer.finish();
        }}
        aria-label={side === "left" ? "좌 조이스틱" : "우 조이스틱"}
      >
        {showTouchZone && (
          <div
            className={`pointer-events-none absolute inset-0 rounded-2xl border ${
              side === "left"
                ? "border-red-200/65"
                : "border-sky-200/65"
            } bg-transparent`}
          />
        )}
        {highlighted && (
          <div className="yanmar-joystick-highlight absolute inset-[-10%] rounded-full border-2 border-amber-300/95 bg-amber-300/10" />
        )}
        {isDisabled && (
          <div className="absolute inset-0 rounded-2xl bg-transparent" />
        )}
      </div>

    </>
  );
}

interface TravelLeverProps {
  side: "left" | "right";
  layout: JoystickLayout;
  enabled: boolean;
  highlighted: boolean;
  showTouchZone: boolean;
  isPortrait: boolean;
  onChange: (value: number) => void;
  onDragActiveChange?: (active: boolean) => void;
  onControlPointerDrag?: (pointerId: number, active: boolean) => void;
}

function TravelLever({
  side,
  layout,
  enabled,
  highlighted,
  showTouchZone,
  isPortrait,
  onChange,
  onDragActiveChange,
  onControlPointerDrag,
}: TravelLeverProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const releaseTravel = useCallback(() => {
    const pid = activePointerIdRef.current;
    activePointerIdRef.current = null;
    if (pid != null) onControlPointerDrag?.(pid, false);
    onChange(0);
    onDragActiveChange?.(false);
  }, [onChange, onDragActiveChange, onControlPointerDrag]);
  const pointer = usePointerRelease(releaseTravel);

  useEffect(() => {
    if (enabled) return;
    pointer.finish();
  }, [enabled, pointer.finish]);

  const updateFromEvent = useCallback(
    (clientY: number) => {
      const zone = zoneRef.current;
      if (!zone) return;
      onChange(travelAxisFromClientY(zone, clientY));
    },
    [onChange],
  );

  const handleStart = (e: React.PointerEvent) => {
    if (!enabled) return;
    e.preventDefault();
    activePointerIdRef.current = e.pointerId;
    onControlPointerDrag?.(e.pointerId, true);
    onDragActiveChange?.(true);
    pointer.begin(e.pointerId, zoneRef.current);
    updateFromEvent(e.clientY);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!pointer.dragging.current || pointer.pointerIdRef.current !== e.pointerId) return;
    updateFromEvent(e.clientY);
  };

  const handleEnd = (e: React.PointerEvent) => {
    pointer.finish(e.pointerId);
  };

  const hitboxCenterOffset = isPortrait
    ? side === "left"
      ? "-5%"
      : "5%"
    : side === "left"
      ? "-2.4%"
      : "2.4%";
  const hitboxWidth = isPortrait ? "10%" : "6.6%";
  // 스틱 행정에 맞춘 높이 — 덱 높이 %로 잡으면 하단이 과도하게 후진 구역이 됨
  const hitboxHeight = isPortrait
    ? "calc(var(--yanmar-travel-stick-h, 2.45rem) * 2.4)"
    : "68%";

  return (
    <>
      <div
        ref={zoneRef}
        className={`absolute z-40 touch-none rounded-xl ${!enabled ? "pointer-events-none" : "pointer-events-auto"}`}
        style={{
          left: `calc(${layout.cx * 100}% + ${hitboxCenterOffset})`,
          top: isPortrait ? TRAVEL_BASELINE : `calc(${layout.cy * 100}%)`,
          width: hitboxWidth,
          height: hitboxHeight,
          transform: "translate(-50%, -50%)",
        }}
        onPointerDown={handleStart}
        onPointerMove={handleMove}
        onPointerUp={handleEnd}
        onPointerCancel={handleEnd}
        onLostPointerCapture={() => {
          pointer.finish();
        }}
        aria-label="주행 레버"
      >
        {showTouchZone && (
          <>
            <div
              className={`pointer-events-none absolute inset-0 rounded-xl border ${
                side === "left"
                  ? "border-sky-200/65"
                  : "border-violet-200/65"
              } bg-transparent`}
            />
            <div className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-white/25" />
            <div className="pointer-events-none absolute inset-x-0 top-2/3 border-t border-white/25" />
          </>
        )}
        {highlighted && (
          <div className="absolute inset-[-8%] rounded-xl border-2 border-amber-300/95 bg-amber-300/10" />
        )}
        {!enabled && (
          <div className="absolute inset-0 rounded-xl bg-transparent" />
        )}
      </div>
    </>
  );
}

interface DualTravelCenterProps {
  layout: JoystickLayout;
  enabled: boolean;
  highlighted: boolean;
  showTouchZone: boolean;
  isPortrait: boolean;
  onChange: (value: number) => void;
  onDragActiveChange?: (active: boolean) => void;
  onControlPointerDrag?: (pointerId: number, active: boolean) => void;
}

function DualTravelCenter({
  layout,
  enabled,
  highlighted,
  showTouchZone,
  isPortrait,
  onChange,
  onDragActiveChange,
  onControlPointerDrag,
}: DualTravelCenterProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const releaseTravel = useCallback(() => {
    const pid = activePointerIdRef.current;
    activePointerIdRef.current = null;
    if (pid != null) onControlPointerDrag?.(pid, false);
    onChange(0);
    onDragActiveChange?.(false);
  }, [onChange, onDragActiveChange, onControlPointerDrag]);
  const pointer = usePointerRelease(releaseTravel);

  useEffect(() => {
    if (enabled) return;
    pointer.finish();
  }, [enabled, pointer.finish]);

  const updateFromEvent = useCallback(
    (clientY: number) => {
      const zone = zoneRef.current;
      if (!zone) return;
      onChange(travelAxisFromClientY(zone, clientY));
    },
    [onChange],
  );

  const handleStart = (e: React.PointerEvent) => {
    if (!enabled) return;
    e.preventDefault();
    activePointerIdRef.current = e.pointerId;
    onControlPointerDrag?.(e.pointerId, true);
    onDragActiveChange?.(true);
    pointer.begin(e.pointerId, zoneRef.current);
    updateFromEvent(e.clientY);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!pointer.dragging.current || pointer.pointerIdRef.current !== e.pointerId) return;
    updateFromEvent(e.clientY);
  };

  const handleEnd = (e: React.PointerEvent) => {
    pointer.finish(e.pointerId);
  };

  return (
    <div
      ref={zoneRef}
      className={`absolute z-30 touch-none rounded-xl ${!enabled ? "pointer-events-none" : "pointer-events-auto"}`}
      style={{
        left: `${layout.cx * 100}%`,
        top: isPortrait ? TRAVEL_BASELINE : `calc(${layout.cy * 100}%)`,
        width: isPortrait ? "10%" : "12.5%",
        height: isPortrait
          ? "calc(var(--yanmar-travel-stick-h, 2.45rem) * 2.4)"
          : "68%",
        transform: "translate(-50%, -50%)",
      }}
      onPointerDown={handleStart}
      onPointerMove={handleMove}
      onPointerUp={handleEnd}
      onPointerCancel={handleEnd}
      onLostPointerCapture={() => {
        pointer.finish();
      }}
      aria-label="좌우 주행 레버 동시 조작"
    >
      {showTouchZone && (
        <>
          <div className="pointer-events-none absolute inset-0 rounded-xl border border-emerald-200/60 bg-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-white/25" />
          <div className="pointer-events-none absolute inset-x-0 top-2/3 border-t border-white/25" />
        </>
      )}
      {highlighted && (
        <div className="absolute inset-[-8%] rounded-xl border-2 border-amber-300/80 bg-amber-300/10" />
      )}
    </div>
  );
}

function RpmLever({
  active,
  cx,
  cy,
  showTouchZone,
  onToggle,
  isPortrait,
  embedded = false,
}: {
  active: boolean;
  cx: number;
  cy: number;
  showTouchZone: boolean;
  onToggle: () => void;
  isPortrait: boolean;
  embedded?: boolean;
}) {
  const buttonSize = isPortrait ? "2.85rem" : "2.75rem";

  return (
    <button
      type="button"
      className={`yanmar-aux-button yanmar-aux-button-hydraulic z-40 touch-none active:scale-95 ${
        embedded ? "relative h-full w-full" : "absolute"
      } ${active ? "is-active" : ""} ${isPortrait ? "yanmar-aux-button-portrait" : ""}`}
      style={
        embedded
          ? undefined
          : {
              left: `${cx * 100}%`,
              top: `${cy * 100}%`,
              width: buttonSize,
              height: buttonSize,
              transform: "translate(-50%, -50%)",
            }
      }
      onPointerDown={activateOnPointerDown(onToggle)}
      aria-pressed={active}
      aria-label={active ? "RPM(x2)" : "RPM(x1)"}
    >
      <span className="yanmar-aux-lever-well" aria-hidden>
        <span className="yanmar-menu-control-art yanmar-menu-control-art-rpm" />
      </span>
      <span className="yanmar-aux-button-label">{active ? "RPM(x2)" : "RPM(x1)"}</span>
      {showTouchZone && (
        <span className="pointer-events-none absolute inset-[-6%] rounded-xl border border-sky-200/65 bg-transparent" />
      )}
    </button>
  );
}

function SafetyLever({
  active,
  cx,
  cy,
  showTouchZone,
  onToggle,
  isPortrait,
  embedded = false,
}: {
  active: boolean;
  cx: number;
  cy: number;
  showTouchZone: boolean;
  onToggle: () => void;
  isPortrait: boolean;
  embedded?: boolean;
}) {
  return (
    <button
      type="button"
      className={`yanmar-aux-button yanmar-aux-button-safety z-50 touch-none active:scale-95 ${
        embedded ? "relative h-full w-full" : "absolute"
      } ${active ? "is-active" : ""} ${isPortrait ? "yanmar-aux-button-portrait" : ""}`}
      style={
        embedded
          ? undefined
          : {
              left: `${cx * 100}%`,
              top: `${cy * 100}%`,
              width: isPortrait ? "2.85rem" : "2.75rem",
              height: isPortrait ? "2.85rem" : "2.75rem",
              transform: "translate(-50%, -50%)",
            }
      }
      onPointerDown={activateOnPointerDown(onToggle)}
      aria-pressed={active}
      aria-label={active ? "안전(잠금)" : "안전(해제)"}
    >
      <span className="yanmar-aux-lever-well" aria-hidden>
        <span className="yanmar-menu-control-art yanmar-menu-control-art-safety" />
      </span>
      <span className="yanmar-aux-button-label">{active ? "안전(잠금)" : "안전(해제)"}</span>
      {showTouchZone && (
        <span className="pointer-events-none absolute inset-[-6%] rounded-xl border border-slate-200/65 bg-transparent" />
      )}
    </button>
  );
}

function BladeLever({
  value,
  enabled,
  showTouchZone,
  layout,
  isPortrait,
  onChange,
  embedded = false,
}: {
  value: number;
  enabled: boolean;
  showTouchZone: boolean;
  layout: CockpitLayout;
  isPortrait: boolean;
  onChange: (value: number) => void;
  embedded?: boolean;
}) {
  const blade = layout.blade;
  const zoneRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  const stickRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const [stick, setStick] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const stopRate = useCallback(() => {
    stickRef.current = 0;
    setStick(0);
    setDragging(false);
    lastFrameTimeRef.current = null;
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const animate = useCallback(
    (time: number) => {
      const rate = stickRef.current;
      if (Math.abs(rate) < 0.04) {
        frameRef.current = null;
        lastFrameTimeRef.current = null;
        return;
      }

      const previousTime = lastFrameTimeRef.current ?? time;
      const deltaSeconds = Math.min((time - previousTime) / 1000, 0.05);
      lastFrameTimeRef.current = time;

      const current = valueRef.current;
      // rate > 0(밀기)=하강, rate < 0(당기기)=상승. Full stroke ≈ 2s.
      let next = current + rate * BLADE_SPEED_PER_SECOND * deltaSeconds;
      next = Math.max(BLADE_RAISED, Math.min(BLADE_LOWERED, next));

      if (next !== current) {
        valueRef.current = next;
        onChange(next);
      }

      if (
        (rate > 0 && next >= BLADE_LOWERED - 1e-4) ||
        (rate < 0 && next <= BLADE_RAISED + 1e-4)
      ) {
        frameRef.current = null;
        lastFrameTimeRef.current = null;
        return;
      }

      frameRef.current = requestAnimationFrame(animate);
    },
    [onChange],
  );

  useEffect(() => () => stopRate(), [stopRate]);

  useEffect(() => {
    if (!enabled) stopRate();
  }, [enabled, stopRate]);

  const updateFromEvent = useCallback(
    (clientY: number) => {
      const zone = zoneRef.current;
      if (!zone) return;
      const rect = zone.getBoundingClientRect();
      const cy = rect.top + rect.height / 2;
      const maxR = Math.max(rect.height / 2, 1);
      const dy = Math.max(-maxR, Math.min(maxR, clientY - cy));
      // 위(+)=하강, 아래(-)=상승. 중앙 근처는 중립(정지).
      let nextStick = Math.max(-1, Math.min(1, -dy / maxR));
      if (Math.abs(nextStick) < 0.18) nextStick = 0;
      stickRef.current = nextStick;
      setStick(nextStick);
      if (nextStick !== 0 && frameRef.current == null) {
        lastFrameTimeRef.current = null;
        frameRef.current = requestAnimationFrame(animate);
      }
    },
    [animate],
  );

  const onRelease = useCallback(() => {
    stickRef.current = 0;
    setStick(0);
    setDragging(false);
    lastFrameTimeRef.current = null;
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const pointer = usePointerRelease(onRelease);

  const handleStart = (e: React.PointerEvent) => {
    if (!enabled) return;
    e.preventDefault();
    setDragging(true);
    pointer.begin(e.pointerId, zoneRef.current);
    updateFromEvent(e.clientY);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!pointer.dragging.current || pointer.pointerIdRef.current !== e.pointerId) return;
    updateFromEvent(e.clientY);
  };

  const handleEnd = (e: React.PointerEvent) => {
    pointer.finish(e.pointerId);
  };

  // Dragging: show command stick. Idle: hold visual at blade position (no spring-to-center).
  const visualValue = dragging
    ? stick
    : Math.max(-1, Math.min(1, value * 2 - 1));

  if (embedded) {
    return (
      <div
        className={`yanmar-blade-lever-embedded relative h-full w-full touch-none ${
          !enabled ? "is-disabled" : ""
        }`}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="yanmar-blade-lever-visual yanmar-blade-lever-visual-embedded pointer-events-none" aria-hidden>
          <VisualLever
            cx={0.5}
            cy={0.5}
            value={visualValue}
            color="dark"
            variant="travel"
          />
          <span className="yanmar-blade-lever-label">블레이드</span>
        </div>
        <div
          ref={zoneRef}
          className={`yanmar-blade-lever absolute inset-0 z-50 touch-none rounded-xl ${
            !enabled ? "pointer-events-none is-disabled" : ""
          }`}
          style={{ WebkitTouchCallout: "none" }}
          onPointerDown={handleStart}
          onPointerMove={handleMove}
          onPointerUp={handleEnd}
          onPointerCancel={handleEnd}
          onLostPointerCapture={() => {
            pointer.finish();
          }}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="블레이드 레버"
        >
          {showTouchZone ? (
            <>
              <div className="pointer-events-none absolute inset-0 rounded-xl border border-amber-200/65 bg-transparent" />
              <div className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-white/25" />
              <div className="pointer-events-none absolute inset-x-0 top-2/3 border-t border-white/25" />
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`yanmar-blade-lever-visual pointer-events-none absolute z-30 ${
          !enabled ? "is-disabled" : ""
        }`}
        style={{
          left: `${blade.cx * 100}%`,
          top: TRAVEL_BASELINE,
          transform: "translate(-50%, -50%)",
        }}
        aria-hidden
      >
        <VisualLever
          cx={0.5}
          cy={0.5}
          value={visualValue}
          color="dark"
          variant="travel"
        />
        <span className="yanmar-blade-lever-label">블레이드</span>
      </div>
      <div
        ref={zoneRef}
        className={`yanmar-blade-lever absolute z-50 touch-none rounded-xl ${
          !enabled ? "pointer-events-none is-disabled" : ""
        } ${isPortrait ? "yanmar-blade-lever-portrait" : ""}`}
        style={{
          left: `${blade.cx * 100}%`,
          top: isPortrait ? TRAVEL_BASELINE : `${blade.cy * 100}%`,
          width: isPortrait ? "10%" : "6.6%",
          height: isPortrait ? "40%" : "58%",
          transform: "translate(-50%, -50%)",
          WebkitTouchCallout: "none",
        }}
        onPointerDown={handleStart}
        onPointerMove={handleMove}
        onPointerUp={handleEnd}
        onPointerCancel={handleEnd}
        onLostPointerCapture={() => {
          pointer.finish();
        }}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="블레이드 레버"
      >
        {showTouchZone ? (
          <>
            <div className="pointer-events-none absolute inset-0 rounded-xl border border-amber-200/65 bg-transparent" />
            <div className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-white/25" />
            <div className="pointer-events-none absolute inset-x-0 top-2/3 border-t border-white/25" />
          </>
        ) : null}
      </div>
    </>
  );
}

function AttachmentPedalControl({
  direction,
  canOperate,
  dimmed,
  highlighted = false,
  showTouchZone,
  onChange,
  onRequireAttachment,
  layout,
  isPortrait,
  attachmentType,
}: {
  direction: -1 | 0 | 1;
  /** True when breaker/grapple is equipped and safety lock is off. */
  canOperate: boolean;
  /** Visual-only dim (e.g. safety lock). Missing attachment stays fully visible. */
  dimmed?: boolean;
  highlighted?: boolean;
  showTouchZone: boolean;
  onChange: (direction: -1 | 0 | 1) => void;
  onRequireAttachment?: () => void;
  layout: CockpitLayout;
  isPortrait: boolean;
  attachmentType: AttachmentType;
}) {
  const pedal = layout.breakerPedal;
  const isBreaker = attachmentType === "breaker";
  const isGrapple = attachmentType === "grapple";

  const setDirection = (next: -1 | 0 | 1) => {
    if (next === 0) {
      onChange(0);
      return;
    }
    if (!canOperate) {
      onRequireAttachment?.();
      return;
    }
    onChange(next);
  };

  const pressSide = (
    e: React.PointerEvent<HTMLButtonElement>,
    side: "left" | "right",
  ) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    if (isBreaker) {
      // 브레이커: 왼쪽만 작동
      if (side === "left") setDirection(1);
      else setDirection(0);
      return;
    }
    if (isGrapple) {
      // 집게: 왼쪽=벌림(-1), 오른쪽=집기(1)
      setDirection(side === "left" ? -1 : 1);
      return;
    }
    onRequireAttachment?.();
  };

  const release = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* already released */
    }
    setDirection(0);
  };

  const leftActive =
    (isBreaker && direction > 0) || (isGrapple && direction < 0);
  const rightActive = isGrapple && direction > 0;

  return (
    <div
      aria-label="브레이커 및 집게 좌우 발판"
      aria-disabled={!canOperate}
      className={`yanmar-breaker-pedal-button yanmar-premium-foot-pedal select-none absolute z-40 ${
        direction !== 0 ? "is-active" : ""
      } ${
        leftActive ? "is-left-active" : rightActive ? "is-right-active" : ""
      } ${dimmed ? "is-disabled" : ""} ${highlighted ? "yanmar-visual-highlight" : ""} ${
        isPortrait ? "yanmar-breaker-pedal-button-portrait" : ""
      }`}
      style={{
        left: `${pedal.cx * 100}%`,
        top: FOOT_PEDAL_BASELINE,
        width: isPortrait ? "4.05rem" : "3.85rem",
        height: isPortrait ? "2.55rem" : "2.4rem",
        transform: "translate(-50%, -50%)",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <PremiumFootPedalArt
        accent="amber"
        leftActive={leftActive}
        rightActive={rightActive}
      />
      <button
        type="button"
        className="absolute inset-y-[10%] left-[5%] w-[42%] rounded-l-[0.45rem]"
        aria-label={
          isBreaker
            ? "발판 왼쪽: 브레이커 작동"
            : "발판 왼쪽: 집게 열기"
        }
        aria-pressed={leftActive}
        onPointerDown={(event) => pressSide(event, "left")}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={() => setDirection(0)}
      />
      <button
        type="button"
        className="absolute inset-y-[10%] right-[5%] w-[42%] rounded-r-[0.45rem]"
        aria-label={
          isBreaker
            ? "발판 오른쪽: 브레이커에서는 사용하지 않음"
            : "발판 오른쪽: 집게 닫기"
        }
        aria-pressed={rightActive}
        onPointerDown={(event) => pressSide(event, "right")}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={() => setDirection(0)}
      />
      {highlighted ? (
        <span className="pointer-events-none absolute inset-[-12%] rounded-[0.85rem] border-2 border-amber-300/95 bg-amber-300/10" />
      ) : null}
      {showTouchZone ? (
        <span className="pointer-events-none absolute inset-0 rounded-[0.72rem] border border-amber-200/65" />
      ) : null}
    </div>
  );
}

function PedalSwingControl({
  activeValue,
  showTouchZone,
  onChange,
  layout,
  isPortrait,
}: {
  activeValue: number;
  showTouchZone: boolean;
  onChange: (value: number) => void;
  layout: CockpitLayout;
  isPortrait: boolean;
}) {
  const pedal = layout.rightPedal;
  const valueRef = useRef(activeValue);
  const directionRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const [pressedDirection, setPressedDirection] = useState(0);

  useEffect(() => {
    valueRef.current = activeValue;
  }, [activeValue]);

  const stopAnimation = useCallback(() => {
    directionRef.current = 0;
    lastFrameTimeRef.current = null;
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const animate = useCallback(
    (time: number) => {
      const direction = directionRef.current;
      if (direction === 0) {
        frameRef.current = null;
        lastFrameTimeRef.current = null;
        return;
      }

      const previousTime = lastFrameTimeRef.current ?? time;
      const deltaSeconds = Math.min((time - previousTime) / 1000, 0.05);
      lastFrameTimeRef.current = time;

      const current = valueRef.current;
      let next = current;

      if (direction > 0) {
        next = Math.min(1, current + PEDAL_SWING_SPEED_PER_SECOND * deltaSeconds);
        if (next >= 1 - 1e-4) next = 1;
      } else {
        next = Math.max(-1, current - PEDAL_SWING_SPEED_PER_SECOND * deltaSeconds);
        if (next <= -1 + 1e-4) next = -1;
      }

      if (next !== current) {
        valueRef.current = next;
        onChange(next);
      }

      frameRef.current = requestAnimationFrame(animate);
    },
    [onChange],
  );

  useEffect(() => stopAnimation, [stopAnimation]);

  const press = (e: React.PointerEvent<HTMLButtonElement>, value: number) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    directionRef.current = value;
    setPressedDirection(value);
    lastFrameTimeRef.current = null;
    if (frameRef.current == null) {
      frameRef.current = requestAnimationFrame(animate);
    }
  };

  const release = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* already released */
    }
    setPressedDirection(0);
    stopAnimation();
  };

  const handleLostCapture = () => {
    setPressedDirection(0);
    stopAnimation();
  };

  return (
    <div
      className={`yanmar-breaker-pedal-button yanmar-premium-foot-pedal yanmar-boom-swing-pedal select-none absolute z-40 ${
        pressedDirection !== 0 ? "is-active" : ""
      } ${
        pressedDirection > 0
          ? "is-left-active"
          : pressedDirection < 0
            ? "is-right-active"
            : ""
      } ${isPortrait ? "yanmar-breaker-pedal-button-portrait" : ""}`}
      style={{
        WebkitTouchCallout: "none",
        left: `${pedal.cx * 100}%`,
        top: FOOT_PEDAL_BASELINE,
        width: isPortrait ? "4.05rem" : "3.85rem",
        height: isPortrait ? "2.55rem" : "2.4rem",
        transform: "translate(-50%, -50%)",
      }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="붐 스윙 발판"
    >
      <PremiumFootPedalArt
        accent="cyan"
        leftActive={pressedDirection > 0}
        rightActive={pressedDirection < 0}
      />
      {showTouchZone && (
        <div className="pointer-events-none absolute inset-0 rounded-lg border border-cyan-200/65 bg-transparent">
          <span className="absolute inset-y-[8%] left-[6%] w-[42%] rounded-l-lg border border-cyan-100/35" />
          <span className="absolute inset-y-[8%] right-[6%] w-[42%] rounded-r-lg border border-cyan-100/35" />
        </div>
      )}
      <button
        type="button"
        className="absolute inset-y-[10%] left-[5%] w-[42%] rounded-l-[0.45rem]"
        onPointerDown={(e) => press(e, 1)}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={handleLostCapture}
        onContextMenu={(e) => e.preventDefault()}
        aria-pressed={pressedDirection > 0}
        aria-label="발판 왼쪽: 암 우측 회전"
      />
      <button
        type="button"
        className="absolute inset-y-[10%] right-[5%] w-[42%] rounded-r-[0.45rem]"
        onPointerDown={(e) => press(e, -1)}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={handleLostCapture}
        onContextMenu={(e) => e.preventDefault()}
        aria-pressed={pressedDirection < 0}
        aria-label="발판 오른쪽: 암 좌측 회전"
      />
    </div>
  );
}

interface FunctionMenuProps {
  expanded: boolean;
  onToggle: () => void;
  layout: CockpitLayout;
  isPortrait: boolean;
  showTouchZones: boolean;
  auxiliary: AuxiliaryControlState;
  onAuxiliaryChange: CockpitOverlayProps["onAuxiliaryChange"];
  attachmentType: AttachmentType;
  playerLevel: number;
  unlockAllAttachments?: boolean;
  onAttachmentChange: (attachment: AttachmentType) => void;
}

const ATTACHMENTS: Array<{
  type: AttachmentType;
  label: string;
  icon: string;
}> = [
  {
    type: "bucket",
    label: "버켓",
    icon: "/images/yanmar/2d/attachments/bucket.png",
  },
  {
    type: "breaker",
    label: "브레이커",
    icon: "/images/yanmar/2d/attachments/breaker.png",
  },
  {
    type: "grapple",
    label: "집게",
    icon: "/images/yanmar/2d/attachments/grapple.png",
  },
];

function AttachmentButton({
  type,
  label,
  icon,
  selected,
  playerLevel,
  unlockAll,
  onSelect,
}: {
  type: AttachmentType;
  label: string;
  icon: string;
  selected: boolean;
  playerLevel: number;
  unlockAll?: boolean;
  onSelect: () => void;
}) {
  const unlocked = isAttachmentUnlocked(type, playerLevel, { unlockAll });
  const requiredLevel = getAttachmentRequiredLevel(type);
  return (
    <button
      type="button"
      className={`yanmar-attachment-button${selected ? " is-selected" : ""}${
        unlocked ? "" : " is-locked"
      }`}
      onPointerDown={
        unlocked ? activateOnPointerDown(onSelect) : undefined
      }
      disabled={!unlocked}
      aria-pressed={selected}
      aria-label={
        unlocked ? `${label} 장착` : `${label} 잠김, 레벨 ${requiredLevel} 필요`
      }
    >
      <span
        className={`yanmar-attachment-icon yanmar-attachment-icon-${type}`}
        style={{ backgroundImage: `url("${icon}")` }}
        aria-hidden
      />
      <span className="yanmar-attachment-label">{label}</span>
      {!unlocked ? (
        <span className="yanmar-attachment-lock">Lv.{requiredLevel}</span>
      ) : null}
    </button>
  );
}

function FunctionMenu({
  expanded,
  onToggle,
  layout,
  isPortrait,
  showTouchZones,
  auxiliary,
  onAuxiliaryChange,
  attachmentType,
  playerLevel,
  unlockAllAttachments,
  onAttachmentChange,
}: FunctionMenuProps) {
  const anchorCx = layout.left.cx;
  const toggleCy = AUX_MENU_TOGGLE_CY;
  const buttonSize = getAuxMenuButtonSize(isPortrait);
  const gap = "0.42rem";
  const bladeHeight = `calc(${buttonSize} * 2 + ${gap})`;

  return (
    <div
      className={`yanmar-function-menu${expanded ? " is-expanded" : ""}`}
      style={{
        left: `${anchorCx * 100}%`,
        top: `${toggleCy * 100}%`,
        width: buttonSize,
        height: buttonSize,
        ["--yanmar-function-btn-size" as string]: buttonSize,
        ["--yanmar-function-gap" as string]: gap,
      }}
    >
      <div
        className={`yanmar-function-menu-grid ${expanded ? "is-expanded" : ""}`}
        aria-hidden={!expanded}
      >
        <div className="yanmar-function-menu-attachments">
          {ATTACHMENTS.map((item) => (
            <AttachmentButton
              key={item.type}
              {...item}
              selected={attachmentType === item.type}
              playerLevel={playerLevel}
              unlockAll={unlockAllAttachments}
              onSelect={() => onAttachmentChange(item.type)}
            />
          ))}
        </div>
        <div
          className="yanmar-function-menu-item yanmar-function-menu-item-safety"
          style={{
            width: buttonSize,
            height: buttonSize,
            transitionDelay: `${
              expanded
                ? FUNCTION_MENU_OPEN_DELAYS_MS.safety
                : FUNCTION_MENU_CLOSE_DELAYS_MS.safety
            }ms`,
          }}
        >
          <SafetyLever
            cx={layout.safetyLever.cx}
            cy={layout.safetyLever.cy}
            active={auxiliary.safetyLocked}
            showTouchZone={showTouchZones}
            isPortrait={isPortrait}
            embedded
            onToggle={() =>
              onAuxiliaryChange((current) => ({
                ...current,
                safetyLocked: !current.safetyLocked,
              }))
            }
          />
        </div>

        <div
          className="yanmar-function-menu-item yanmar-function-menu-item-rpm"
          style={{
            width: buttonSize,
            height: buttonSize,
            transitionDelay: `${
              expanded
                ? FUNCTION_MENU_OPEN_DELAYS_MS.rpm
                : FUNCTION_MENU_CLOSE_DELAYS_MS.rpm
            }ms`,
          }}
        >
          <RpmLever
            cx={layout.hydraulicSpeed.cx}
            cy={layout.hydraulicSpeed.cy}
            active={auxiliary.highSpeed}
            showTouchZone={showTouchZones}
            isPortrait={isPortrait}
            embedded
            onToggle={() =>
              onAuxiliaryChange((current) => ({
                ...current,
                highSpeed: !current.highSpeed,
              }))
            }
          />
        </div>

        <div
          className="yanmar-function-menu-item yanmar-function-menu-item-blade"
          style={{
            width: buttonSize,
            height: bladeHeight,
            transitionDelay: `${
              expanded
                ? FUNCTION_MENU_OPEN_DELAYS_MS.blade
                : FUNCTION_MENU_CLOSE_DELAYS_MS.blade
            }ms`,
          }}
        >
          <BladeLever
            value={auxiliary.blade}
            enabled={!auxiliary.safetyLocked}
            showTouchZone={showTouchZones}
            layout={layout}
            isPortrait={isPortrait}
            embedded
            onChange={(blade) =>
              onAuxiliaryChange((current) => ({ ...current, blade }))
            }
          />
        </div>
      </div>

      <button
        type="button"
        className={`yanmar-function-menu-toggle yanmar-aux-button touch-none active:scale-95${
          expanded ? " is-expanded" : ""
        }${isPortrait ? " yanmar-aux-button-portrait yanmar-function-menu-toggle-portrait" : ""}`}
        style={{
          width: buttonSize,
          height: buttonSize,
        }}
        onPointerDown={activateOnPointerDown(onToggle)}
        aria-expanded={expanded}
        aria-label={expanded ? "기능 메뉴 닫기" : "기능 메뉴 열기"}
      >
        <span className="yanmar-function-menu-icon" aria-hidden />
        <span className="yanmar-function-menu-toggle-label">기능</span>
        {showTouchZones ? (
          <span className="pointer-events-none absolute inset-[-6%] rounded-xl border border-emerald-200/65 bg-transparent" />
        ) : null}
      </button>
    </div>
  );
}

function AutoMenuActionButton({
  variant,
  slot,
  label,
  active = false,
  disabled = false,
  onClick,
  showTouchZone,
  ariaLabel,
}: {
  variant: "save" | "execute";
  slot: AutoPoseSlotIndex;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  showTouchZone: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      className={`yanmar-auto-menu-action yanmar-aux-button relative h-full w-full touch-none active:scale-95${
        active ? " is-active" : ""
      }${disabled ? " is-disabled" : ""}`}
      onPointerDown={
        disabled
          ? undefined
          : activateOnPointerDown(onClick)
      }
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <span
        className={`yanmar-auto-menu-icon yanmar-auto-menu-action-icon yanmar-auto-menu-icon-${variant === "execute" ? "play" : variant}`}
        aria-hidden
      />
      <span className="yanmar-auto-menu-action-label">{label}</span>
      {showTouchZone ? (
        <span className="pointer-events-none absolute inset-[-6%] rounded-xl border border-violet-200/65 bg-transparent" />
      ) : null}
    </button>
  );
}

function AutoPoseLabelsModal({
  open,
  labels,
  onClose,
  onSave,
}: {
  open: boolean;
  labels: AutoPoseSlotLabels;
  onClose: () => void;
  onSave: (labels: AutoPoseSlotLabels) => void;
}) {
  const [draft, setDraft] = useState<AutoPoseSlotLabels>(labels);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(labels);
    setError(null);
  }, [open, labels]);

  if (!open) return null;

  const handleSave = () => {
    const defaults = defaultAutoPoseSlotLabels();
    const next: AutoPoseSlotLabels = [...defaults];
    for (let i = 0; i < AUTO_POSE_SLOT_COUNT; i++) {
      const trimmed = draft[i].normalize("NFC").trim();
      const len = countAutoPoseLabelChars(trimmed);
      if (len < AUTO_POSE_LABEL_MIN_CHARS || len > AUTO_POSE_LABEL_MAX_CHARS) {
        setError(`실행${i + 1} 이름은 ${AUTO_POSE_LABEL_MIN_CHARS}~${AUTO_POSE_LABEL_MAX_CHARS}글자로 입력하세요.`);
        return;
      }
      next[i] = Array.from(trimmed).join("");
    }
    onSave(next);
    onClose();
  };

  return (
    <div className="yanmar-auto-label-modal-layer" role="presentation">
      <button
        type="button"
        className="yanmar-auto-label-modal-backdrop"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        className="yanmar-auto-label-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="yanmar-auto-label-modal-title"
      >
        <div className="yanmar-auto-label-modal-header">
          <h2 id="yanmar-auto-label-modal-title">실행 이름 편집</h2>
          <button type="button" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <p className="yanmar-auto-label-modal-hint">
          실행 버튼 이름을 {AUTO_POSE_LABEL_MIN_CHARS}~{AUTO_POSE_LABEL_MAX_CHARS}
          글자로 설정할 수 있습니다.
        </p>
        <ul className="yanmar-auto-label-modal-list">
          {AUTO_POSE_SLOT_ORDER.map((slot) => (
            <li key={slot}>
              <label htmlFor={`yanmar-auto-label-${slot}`}>
                실행{slot + 1}
              </label>
              <input
                id={`yanmar-auto-label-${slot}`}
                type="text"
                value={draft[slot]}
                maxLength={AUTO_POSE_LABEL_MAX_CHARS * 2}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => {
                  const chars = Array.from(event.target.value.normalize("NFC")).slice(
                    0,
                    AUTO_POSE_LABEL_MAX_CHARS,
                  );
                  setDraft((prev) => {
                    const next: AutoPoseSlotLabels = [...prev];
                    next[slot] = chars.join("");
                    return next;
                  });
                  setError(null);
                }}
              />
              <span className="yanmar-auto-label-modal-count tabular-nums">
                {countAutoPoseLabelChars(draft[slot])}/{AUTO_POSE_LABEL_MAX_CHARS}
              </span>
            </li>
          ))}
        </ul>
        {error ? <p className="yanmar-auto-label-modal-error">{error}</p> : null}
        <div className="yanmar-auto-label-modal-actions">
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button type="button" className="is-primary" onClick={handleSave}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

interface AutoMenuProps {
  expanded: boolean;
  onToggle: () => void;
  buttonSize: string;
  showTouchZones: boolean;
  autoPose: AutoPoseState;
  autoPoseLabels: AutoPoseSlotLabels;
  onSavePose: (slot: AutoPoseSlotIndex) => void;
  onExecutePose: (slot: AutoPoseSlotIndex) => void;
  onEditLabels: () => void;
  savePoseDisabled?: boolean;
  executePoseDisabled?: boolean;
  isPortrait: boolean;
}

function HornAutoCluster({
  layout,
  isPortrait,
  showTouchZones,
  onHorn,
  autoExpanded,
  onAutoToggle,
  autoPose,
  autoPoseLabels,
  onSavePose,
  onExecutePose,
  onEditLabels,
  savePoseDisabled = false,
  executePoseDisabled = false,
}: {
  layout: CockpitLayout;
  isPortrait: boolean;
  showTouchZones: boolean;
  onHorn: () => void;
  autoExpanded: boolean;
  onAutoToggle: () => void;
  autoPose: AutoPoseState;
  autoPoseLabels: AutoPoseSlotLabels;
  onSavePose: (slot: AutoPoseSlotIndex) => void;
  onExecutePose: (slot: AutoPoseSlotIndex) => void;
  onEditLabels: () => void;
  savePoseDisabled?: boolean;
  executePoseDisabled?: boolean;
}) {
  const buttonSize = getAuxMenuButtonSize(isPortrait);
  const anchorCx = layout.horn.cx;
  const toggleCy = AUX_MENU_TOGGLE_CY;

  return (
    <div
      className="yanmar-horn-auto-cluster"
      style={{
        left: `${anchorCx * 100}%`,
        top: `${toggleCy * 100}%`,
        // 클러스터 우측(자동) 버튼 중심이 horn.cx 에 오도록
        transform: `translate(calc(-1 * (${buttonSize} * 1.5 + ${HORN_AUTO_GAP})), -50%)`,
        gap: HORN_AUTO_GAP,
      }}
    >
      <button
        type="button"
        className={`yanmar-horn-standalone yanmar-aux-button touch-none active:scale-95${
          isPortrait ? " yanmar-aux-button-portrait" : ""
        }`}
        style={{
          width: buttonSize,
          height: buttonSize,
          minWidth: buttonSize,
          minHeight: buttonSize,
        }}
        onPointerDown={activateOnPointerDown(onHorn)}
        aria-label="경적"
      >
        <img
          className="yanmar-horn-standalone-icon"
          src="/images/yanmar/2d/cockpit/horn-hud-premium.png?v=2"
          alt=""
          draggable={false}
        />
        <span className="yanmar-horn-standalone-label">경적</span>
        {showTouchZones ? (
          <span className="pointer-events-none absolute inset-[-6%] rounded-xl border border-amber-200/65 bg-transparent" />
        ) : null}
      </button>
      <AutoMenu
        expanded={autoExpanded}
        onToggle={onAutoToggle}
        buttonSize={buttonSize}
        isPortrait={isPortrait}
        showTouchZones={showTouchZones}
        autoPose={autoPose}
        autoPoseLabels={autoPoseLabels}
        onSavePose={onSavePose}
        onExecutePose={onExecutePose}
        onEditLabels={onEditLabels}
        savePoseDisabled={savePoseDisabled}
        executePoseDisabled={executePoseDisabled}
      />
    </div>
  );
}

function AutoMenu({
  expanded,
  onToggle,
  buttonSize,
  isPortrait,
  showTouchZones,
  autoPose,
  autoPoseLabels,
  onSavePose,
  onExecutePose,
  onEditLabels,
  savePoseDisabled = false,
  executePoseDisabled = false,
}: AutoMenuProps) {
  const editOpenDelayMs = AUTO_POSE_SLOT_ORDER.length * 50;
  const editCloseDelayMs = 0;

  return (
    <div
      className="yanmar-auto-menu"
      style={{
        width: buttonSize,
        height: buttonSize,
        minWidth: buttonSize,
        minHeight: buttonSize,
      }}
    >
      <div className={`yanmar-auto-menu-items ${expanded ? "is-expanded" : ""}`}>
        {AUTO_POSE_SLOT_ORDER.map((slot, index) => {
          const openDelayMs = index * 50;
          const closeDelayMs = (AUTO_POSE_SLOT_ORDER.length - 1 - index) * 35;
          const hasSavedPose = autoPose.slots[slot] != null;
          const isExecutingThis =
            autoPose.executing && autoPose.activeSlot === slot;
          const executeLabel = autoPoseLabels[slot] || `실행${slot + 1}`;

          return (
            <div
              key={slot}
              className="yanmar-auto-menu-item"
              style={{
                transitionDelay: `${expanded ? openDelayMs : closeDelayMs}ms`,
              }}
              aria-hidden={!expanded}
            >
              <div
                className="yanmar-auto-menu-slot-row"
                style={{
                  height: buttonSize,
                }}
              >
                <div style={{ width: buttonSize, height: buttonSize }}>
                  <AutoMenuActionButton
                    variant="execute"
                    slot={slot}
                    label={executeLabel}
                    active={isExecutingThis}
                    disabled={!hasSavedPose || autoPose.executing || executePoseDisabled}
                    onClick={() => onExecutePose(slot)}
                    showTouchZone={showTouchZones}
                    ariaLabel={
                      executePoseDisabled
                        ? `${executeLabel} 자세 실행 대기 중`
                        : isExecutingThis
                          ? `${executeLabel} 자동 자세 실행 중`
                          : `${executeLabel} 저장된 자세 실행`
                    }
                  />
                </div>
                <div style={{ width: buttonSize, height: buttonSize }}>
                  <AutoMenuActionButton
                    variant="save"
                    slot={slot}
                    label={`저장${slot + 1}`}
                    active={hasSavedPose}
                    disabled={savePoseDisabled}
                    onClick={() => onSavePose(slot)}
                    showTouchZone={showTouchZones}
                    ariaLabel={
                      savePoseDisabled
                        ? `슬롯 ${slot + 1} 자세 저장 대기 중`
                        : hasSavedPose
                          ? `슬롯 ${slot + 1} 자세 저장됨`
                          : `슬롯 ${slot + 1}에 현재 자세 저장`
                    }
                  />
                </div>
              </div>
            </div>
          );
        })}
        <div
          className="yanmar-auto-menu-item yanmar-auto-menu-edit-item"
          style={{
            transitionDelay: `${expanded ? editOpenDelayMs : editCloseDelayMs}ms`,
          }}
          aria-hidden={!expanded}
        >
          <button
            type="button"
            className="yanmar-auto-menu-edit yanmar-aux-button touch-none active:scale-95"
            style={{
              width: `calc(${buttonSize} * 2 + 0.38rem)`,
              height: `calc(${buttonSize} * 0.72)`,
            }}
            onPointerDown={activateOnPointerDown(onEditLabels)}
            aria-label="실행 이름 편집"
          >
            <span className="yanmar-auto-menu-edit-label">편집</span>
          </button>
        </div>
      </div>

      <button
        type="button"
        className={`yanmar-auto-menu-toggle yanmar-aux-button touch-none active:scale-95${
          expanded ? " is-expanded" : ""
        }${isPortrait ? " yanmar-aux-button-portrait yanmar-auto-menu-toggle-portrait" : ""}`}
        style={{
          width: buttonSize,
          height: buttonSize,
          minWidth: buttonSize,
          minHeight: buttonSize,
        }}
        onPointerDown={activateOnPointerDown(onToggle)}
        aria-expanded={expanded}
        aria-label={expanded ? "자동 메뉴 닫기" : "자동 메뉴 열기"}
      >
        <span className="yanmar-auto-menu-icon yanmar-auto-menu-icon-auto" aria-hidden />
        <span className="yanmar-auto-menu-toggle-label">자동</span>
        {showTouchZones ? (
          <span className="pointer-events-none absolute inset-[-6%] rounded-xl border border-violet-200/65 bg-transparent" />
        ) : null}
      </button>
    </div>
  );
}

export function CockpitOverlay({
  mode,
  input,
  onInputChange,
  auxiliary,
  onAuxiliaryChange,
  allowed,
  tutorialStep,
  showTouchZones,
  hideVisualDeck = false,
  autoPose,
  autoPoseLabels,
  onSavePose,
  onExecutePose,
  onSaveAutoPoseLabels,
  savePoseDisabled = false,
  executePoseDisabled = false,
  attachmentType,
  playerLevel,
  unlockAllAttachments = false,
  onAttachmentChange,
  onAttachmentWarning,
  hornId = 1,
  onHorn,
}: CockpitOverlayProps) {
  const highlightLeft =
    tutorialStep?.highlight === "left" || tutorialStep?.highlight === "both";
  const highlightRight =
    tutorialStep?.highlight === "right" || tutorialStep?.highlight === "both";
  const highlightTravel = tutorialStep?.highlight === "travel";
  const highlightBreaker = tutorialStep?.highlight === "breaker";
  const layout = PORTRAIT_COCKPIT_LAYOUT;
  const isPortrait = true;
  const useDPad = mode !== "intro";
  const [functionMenuExpanded, setFunctionMenuExpanded] = useState(false);
  const [autoMenuExpanded, setAutoMenuExpanded] = useState(false);
  const [autoLabelModalOpen, setAutoLabelModalOpen] = useState(false);
  /** 중앙 동시 레버와 좌·우 개별 레버는 서로 배타. 좌·우는 동시 조작 가능. */
  const [travelLock, setTravelLock] = useState<"sides" | "both" | null>(null);
  const sideTravelActiveRef = useRef({ left: false, right: false });
  /** 조작 드래그 중인 pointerId — 같은 손가락의 버튼 오입력만 차단 */
  const controlDragPointersRef = useRef(new Set<number>());
  const travelEnabled = allowed.travel && !auxiliary.safetyLocked;
  const pedalAttachmentEquipped =
    attachmentType === "breaker" || attachmentType === "grapple";
  const attachmentPedalCanOperate =
    pedalAttachmentEquipped && !auxiliary.safetyLocked;

  const setControlPointerDrag = useCallback((pointerId: number, active: boolean) => {
    if (active) {
      controlDragPointersRef.current.add(pointerId);
      return;
    }
    controlDragPointersRef.current.delete(pointerId);
  }, []);

  const syncSideTravelLock = useCallback(() => {
    const { left, right } = sideTravelActiveRef.current;
    setTravelLock(left || right ? "sides" : null);
  }, []);

  useEffect(() => {
    if (!travelEnabled) {
      sideTravelActiveRef.current = { left: false, right: false };
      setTravelLock(null);
      if (input.travel.left !== 0 || input.travel.right !== 0) {
        onInputChange((current) => ({
          ...current,
          travel: { left: 0, right: 0 },
        }));
      }
    }
  }, [travelEnabled, input.travel.left, input.travel.right, onInputChange]);

  useEffect(() => {
    if (attachmentPedalCanOperate) return;
    if (auxiliary.attachmentPedal === 0) return;
    onAuxiliaryChange((current) => ({ ...current, attachmentPedal: 0 }));
  }, [
    auxiliary.attachmentPedal,
    attachmentPedalCanOperate,
    onAuxiliaryChange,
  ]);

  return (
    <>
      <div className="yanmar-control-deck pointer-events-none absolute inset-x-0 z-10 mx-auto">
        <div className="relative h-full w-full">
          {!hideVisualDeck ? (
            <VisualControlDeck
              input={input}
              highlightLeft={highlightLeft}
              highlightRight={highlightRight}
              highlightTravel={highlightTravel}
              layout={layout}
              isPortrait={isPortrait}
              useDPad={useDPad}
            />
          ) : null}
        </div>
      </div>

      {useDPad ? (
        <div className="pointer-events-none absolute inset-0 z-[60] overflow-visible">
          <MainDPadVisual
            side="left"
            value={input.left}
            layout={layout.left}
            isPortrait={isPortrait}
            screenOverlay
          />
          <MainDPadVisual
            side="right"
            value={input.right}
            layout={layout.right}
            isPortrait={isPortrait}
            screenOverlay
          />
        </div>
      ) : null}

      <div className="yanmar-control-deck yanmar-control-touch-layer absolute inset-x-0 z-20 mx-auto touch-none">
        <div className="relative h-full w-full">
          <TravelLever
            side="left"
            layout={layout.travelLeft}
            enabled={travelEnabled && travelLock !== "both"}
            highlighted={highlightTravel}
            showTouchZone={showTouchZones}
            isPortrait={isPortrait}
            onDragActiveChange={(active) => {
              sideTravelActiveRef.current.left = active;
              syncSideTravelLock();
            }}
            onControlPointerDrag={setControlPointerDrag}
            onChange={(left) =>
              onInputChange((current) => ({
                ...current,
                travel: { left, right: current.travel.right },
              }))
            }
          />
          <TravelLever
            side="right"
            layout={layout.travelRight}
            enabled={travelEnabled && travelLock !== "both"}
            highlighted={highlightTravel}
            showTouchZone={showTouchZones}
            isPortrait={isPortrait}
            onDragActiveChange={(active) => {
              sideTravelActiveRef.current.right = active;
              syncSideTravelLock();
            }}
            onControlPointerDrag={setControlPointerDrag}
            onChange={(right) =>
              onInputChange((current) => ({
                ...current,
                travel: { left: current.travel.left, right },
              }))
            }
          />
          <DualTravelCenter
            layout={layout.travelBoth}
            enabled={travelEnabled && travelLock !== "sides"}
            highlighted={highlightTravel}
            showTouchZone={showTouchZones}
            isPortrait={isPortrait}
            onDragActiveChange={(active) =>
              setTravelLock((current) => {
                if (active) return "both";
                return current === "both" ? null : current;
              })
            }
            onControlPointerDrag={setControlPointerDrag}
            onChange={(value) =>
              onInputChange((current) => ({
                ...current,
                travel: { left: value, right: value },
              }))
            }
          />
          <AttachmentPedalControl
            direction={auxiliary.attachmentPedal}
            canOperate={attachmentPedalCanOperate}
            dimmed={pedalAttachmentEquipped && auxiliary.safetyLocked}
            highlighted={highlightBreaker}
            showTouchZone={showTouchZones}
            layout={layout}
            isPortrait={isPortrait}
            attachmentType={attachmentType}
            onRequireAttachment={
              pedalAttachmentEquipped
                ? undefined
                : () =>
                    onAttachmentWarning?.(
                      "브레이커 또는 집게를 장착 후 사용하세요.",
                    )
            }
            onChange={(attachmentPedal) =>
              onAuxiliaryChange((current) => ({
                ...current,
                attachmentPedal,
              }))
            }
          />
          <PedalSwingControl
            activeValue={auxiliary.boomSwing}
            showTouchZone={showTouchZones}
            layout={layout}
            isPortrait={isPortrait}
            onChange={(boomSwing) =>
              onAuxiliaryChange((current) => ({ ...current, boomSwing }))
            }
          />
          <GameJoystick
            side="left"
            layout={layout.left}
            enabled={{
              x: allowed.leftX && !auxiliary.safetyLocked,
              y: allowed.leftY && !auxiliary.safetyLocked,
            }}
            highlighted={highlightLeft}
            showTouchZone={showTouchZones}
            isPortrait={isPortrait}
            useDPad={useDPad}
            onControlPointerDrag={setControlPointerDrag}
            onChange={(x, y) =>
              onInputChange((current) => ({ ...current, left: { x, y } }))
            }
          />
          <GameJoystick
            side="right"
            layout={layout.right}
            enabled={{
              x: allowed.rightX && !auxiliary.safetyLocked,
              y: allowed.rightY && !auxiliary.safetyLocked,
            }}
            highlighted={highlightRight}
            showTouchZone={showTouchZones}
            isPortrait={isPortrait}
            useDPad={useDPad}
            onControlPointerDrag={setControlPointerDrag}
            onChange={(x, y) =>
              onInputChange((current) => ({ ...current, right: { x, y } }))
            }
          />
        </div>
      </div>

      {/* 주행·조이스틱보다 위에 두어 주행 중에도 기능/자동/경적 클릭 가능 */}
      <div className="yanmar-control-deck yanmar-aux-menu-layer absolute inset-x-0 z-[80] mx-auto pointer-events-none">
        <div className="relative h-full w-full">
          <FunctionMenu
            expanded={functionMenuExpanded}
            onToggle={() => setFunctionMenuExpanded((open) => !open)}
            layout={layout}
            isPortrait={isPortrait}
            showTouchZones={showTouchZones}
            auxiliary={auxiliary}
            onAuxiliaryChange={onAuxiliaryChange}
            attachmentType={attachmentType}
            playerLevel={playerLevel}
            unlockAllAttachments={unlockAllAttachments}
            onAttachmentChange={onAttachmentChange}
          />
          <HornAutoCluster
            layout={layout}
            isPortrait={isPortrait}
            showTouchZones={showTouchZones}
            onHorn={() => {
              yanmarAudio.playHorn(hornId);
              onHorn?.();
            }}
            autoExpanded={autoMenuExpanded}
            onAutoToggle={() => setAutoMenuExpanded((open) => !open)}
            autoPose={autoPose}
            autoPoseLabels={autoPoseLabels}
            onSavePose={onSavePose}
            onExecutePose={onExecutePose}
            onEditLabels={() => setAutoLabelModalOpen(true)}
            savePoseDisabled={savePoseDisabled}
            executePoseDisabled={executePoseDisabled}
          />
        </div>
      </div>

      <AutoPoseLabelsModal
        open={autoLabelModalOpen}
        labels={autoPoseLabels}
        onClose={() => setAutoLabelModalOpen(false)}
        onSave={onSaveAutoPoseLabels}
      />
    </>
  );
}
