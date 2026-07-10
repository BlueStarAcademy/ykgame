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
import type { TutorialStep } from "./tutorial";
import type { AttachmentType, AutoPoseSlotIndex, AutoPoseState } from "./types";
import { AUTO_POSE_SLOT_COUNT } from "./types";
import {
  getAttachmentRequiredLevel,
  isAttachmentUnlocked,
} from "@/lib/playerUnlocks";


interface CockpitOverlayProps {
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
  onSavePose: (slot: AutoPoseSlotIndex) => void;
  onExecutePose: (slot: AutoPoseSlotIndex) => void;
  savePoseDisabled?: boolean;
  executePoseDisabled?: boolean;
  attachmentType: AttachmentType;
  playerLevel: number;
  onAttachmentChange: (attachment: AttachmentType) => void;
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

/** 좌·우 보조 메뉴 토글 공통 높이 (기능 / 자동) */
const AUX_MENU_TOGGLE_CY = 0.495;

function getHornTouchZoneStyle(layout: JoystickLayout, isPortrait: boolean) {
  const { centerYOffset, heightHalfPct, width } = getJoystickZoneMetrics(isPortrait);
  const autoToggleHalf = isPortrait ? "1.425rem" : "1.375rem";
  const gap = isPortrait ? "0.24rem" : "0.2rem";
  const joystickCenterTop = (layout.cy - centerYOffset) * 100;

  return {
    left: `${layout.cx * 100}%`,
    top: `calc(${AUX_MENU_TOGGLE_CY * 100}% + ${autoToggleHalf} + ${gap})`,
    bottom: `calc(${100 - joystickCenterTop}% + ${heightHalfPct}% + ${gap})`,
    width,
    transform: "translateX(-50%)",
  };
}

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
  travelLeft: { ...COCKPIT_LAYOUT.travelLeft, cx: 0.455, cy: 0.92 },
  travelRight: { ...COCKPIT_LAYOUT.travelRight, cx: 0.545, cy: 0.92 },
  travelBoth: { ...COCKPIT_LAYOUT.travelBoth, cx: 0.5, cy: 0.92 },
  rightPedal: { ...COCKPIT_LAYOUT.rightPedal, cx: 0.1, cy: 0.165 },
  hydraulicSpeed: { ...COCKPIT_LAYOUT.hydraulicSpeed, cx: 0.1, cy: 0.275 },
  blade: { ...COCKPIT_LAYOUT.blade, cx: 0.72, cy: 0.965 },
  horn: { ...COCKPIT_LAYOUT.horn, cx: 0.9, cy: 0.495 },
};

const FUNCTION_MENU_OPEN_DELAYS_MS = {
  safety: 0,
  rpm: 50,
  pedal: 100,
} as const;
const FUNCTION_MENU_CLOSE_DELAYS_MS = {
  pedal: 0,
  rpm: 35,
  safety: 70,
} as const;

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
          {side === "right" ? (
            <span className="yanmar-realstick-horn yanmar-realstick-horn-top" aria-hidden />
          ) : null}
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
  cy: number;
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
    : isTravel
      ? pullDepth * 0.58 - pushDepth * 0.5
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
  const travelDepth = isTravel ? pushDepth * 0.18 + pullDepth * 0.1 : 0;
  const stickTransform = isTravel
    ? `translate3d(-50%, ${stickDrop}rem, ${travelDepth}rem) rotateX(${bendX}deg)`
    : `translate3d(-50%, ${stickDrop}rem, 0) rotateX(${bendX}deg)`;
  return (
    <div
      className={`yanmar-visual-part yanmar-visual-lever ${
        highlighted ? "yanmar-visual-highlight" : ""
      } ${variant === "safety" ? "yanmar-visual-lever-safety" : ""} ${
        variant === "hydraulic" ? "yanmar-visual-lever-hydraulic" : ""
      } ${variant === "travel" ? "yanmar-visual-lever-travel" : ""} ${
        compact ? "yanmar-visual-lever-compact" : ""
      }`}
      style={
        compact ? undefined : { left: `${cx * 100}%`, top: `${cy * 100}%` }
      }
    >
      <div className="yanmar-lever-mount" />
      <div className="yanmar-lever-slot" />
      <div className="yanmar-lever-pivot">
        <div
          className={`yanmar-lever-stick yanmar-lever-${color}`}
          style={{
            transform: stickTransform,
          }}
        >
          <span />
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
      <VisualLever
        cx={layout.travelLeft.cx}
        cy={layout.travelLeft.cy}
        value={left}
        color="dark"
        highlighted={highlighted}
        variant="travel"
      />
      <VisualLever
        cx={layout.travelRight.cx}
        cy={layout.travelRight.cy}
        value={right}
        color="dark"
        highlighted={highlighted}
        variant="travel"
      />
    </div>
  );
}

function VisualPedal({
  value,
  layout,
}: {
  value: number;
  layout: CockpitLayout;
}) {
  const top = Math.max(0, value);
  const bottom = Math.max(0, -value);
  const pedal = layout.rightPedal;
  const pressOffset = (top - bottom) * 0.22;

  return (
    <div
      className="yanmar-visual-part yanmar-visual-pedal"
      style={{
        left: `${(pedal.cx + 0.03) * 100}%`,
        top: `${pedal.cy * 100}%`,
      }}
    >
      <div
        className="yanmar-pedal-pad"
        style={{
          transform: `translate(-50%, ${pressOffset}rem)`,
        }}
      />
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

function VisualControlDeck({
  input,
  highlightLeft,
  highlightRight,
  highlightTravel,
  layout,
  isPortrait,
}: {
  input: ExcavatorControlState;
  highlightLeft: boolean;
  highlightRight: boolean;
  highlightTravel: boolean;
  layout: CockpitLayout;
  isPortrait: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="yanmar-control-rail">
        <div className="yanmar-deck-brand-badge">YANMAR</div>
        <div className="yanmar-deck-instrument-strip" />
        <div className="yanmar-bottom-connector" />
      </div>
      <VisualJoystick side="left" value={input.left} highlighted={highlightLeft} layout={layout} isPortrait={isPortrait} />
      <VisualTravelLevers
        left={input.travel.left}
        right={input.travel.right}
        highlighted={highlightTravel}
        layout={layout}
      />
      <VisualJoystick side="right" value={input.right} highlighted={highlightRight} layout={layout} isPortrait={isPortrait} />
    </div>
  );
}

function playHorn() {
  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;

  const ctx = new AudioContextCtor();
  const now = ctx.currentTime;
  const master = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  filter.type = "bandpass";
  filter.frequency.setValueAtTime(460, now);
  filter.Q.setValueAtTime(1.2, now);
  master.gain.setValueAtTime(0.9, now);
  master.connect(filter);
  filter.connect(gain);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.025);
  gain.gain.setValueAtTime(0.2, now + 0.32);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
  gain.connect(ctx.destination);

  [410, 515].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = i === 0 ? "triangle" : "sine";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.linearRampToValueAtTime(freq * 0.985, now + 0.5);
    osc.connect(master);
    osc.start(now + i * 0.015);
    osc.stop(now + 0.6);
  });

  window.setTimeout(() => void ctx.close(), 760);
}

function usePointerRelease(onRelease: () => void) {
  const pointerIdRef = useRef<number | null>(null);
  const dragging = useRef(false);

  const releaseCapture = useCallback((el: HTMLElement | null) => {
    const pid = pointerIdRef.current;
    if (el && pid !== null) {
      try {
        if (el.hasPointerCapture(pid)) el.releasePointerCapture(pid);
      } catch {
        /* already released */
      }
    }
    pointerIdRef.current = null;
    dragging.current = false;
  }, []);

  return { pointerIdRef, dragging, releaseCapture, onRelease };
}

interface GameJoystickProps {
  side: "left" | "right";
  layout: JoystickLayout;
  enabled: { x: boolean; y: boolean };
  highlighted: boolean;
  showTouchZone: boolean;
  isPortrait: boolean;
  onChange: (x: number, y: number) => void;
}

function GameJoystick({
  side,
  layout,
  enabled,
  highlighted,
  showTouchZone,
  isPortrait,
  onChange,
}: GameJoystickProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const pointer = usePointerRelease(() => onChange(0, 0));
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
      const rawX = enabled.x ? dx / halfW : 0;
      const rawY = enabled.y ? -dy / halfH : 0;
      const useX = Math.abs(rawX) >= Math.abs(rawY);
      const nx = useX ? rawX : 0;
      const ny = useX ? 0 : rawY;
      onChange(nx, ny);
    },
    [enabled.x, enabled.y, onChange],
  );

  const handleStart = (e: React.PointerEvent) => {
    if (!enabled.x && !enabled.y) return;
    e.preventDefault();
    pointer.dragging.current = true;
    pointer.pointerIdRef.current = e.pointerId;
    zoneRef.current?.setPointerCapture(e.pointerId);
    updateFromEvent(e.clientX, e.clientY);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!pointer.dragging.current || pointer.pointerIdRef.current !== e.pointerId) return;
    updateFromEvent(e.clientX, e.clientY);
  };

  const handleEnd = (e: React.PointerEvent) => {
    if (pointer.pointerIdRef.current !== e.pointerId) return;
    pointer.releaseCapture(zoneRef.current);
    pointer.onRelease();
  };

  const isDisabled = !enabled.x && !enabled.y;

  return (
    <>
      <div
        ref={zoneRef}
        className={`absolute z-50 touch-none rounded-2xl ${isDisabled ? "pointer-events-none" : ""}`}
        style={{
          left: `${layout.cx * 100}%`,
          top: `${(layout.cy - joystickZone.centerYOffset) * 100}%`,
          width: joystickZone.width,
          height: joystickZone.height,
          transform: "translate(-50%, -50%)",
        }}
        onPointerDown={handleStart}
        onPointerMove={handleMove}
        onPointerUp={handleEnd}
        onPointerCancel={handleEnd}
        onLostPointerCapture={() => {
          pointer.dragging.current = false;
          pointer.pointerIdRef.current = null;
          onChange(0, 0);
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

function HornTouchZone({
  layout,
  isPortrait,
  showTouchZone,
  onHorn,
}: {
  layout: JoystickLayout;
  isPortrait: boolean;
  showTouchZone: boolean;
  onHorn: () => void;
}) {
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    onHorn();
  };

  return (
    <div
      className="yanmar-horn-touch-zone absolute touch-none"
      style={getHornTouchZoneStyle(layout, isPortrait)}
      onPointerDown={handlePointerDown}
      role="button"
      tabIndex={-1}
      aria-label="경적"
    >
      {showTouchZone ? (
        <span className="pointer-events-none absolute inset-0 border border-yellow-200/70 bg-yellow-200/10" />
      ) : null}
    </div>
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
}: TravelLeverProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const releaseTravel = useCallback(() => {
    onChange(0);
    onDragActiveChange?.(false);
  }, [onChange, onDragActiveChange]);
  const pointer = usePointerRelease(releaseTravel);

  const updateFromEvent = useCallback(
    (clientY: number) => {
      const zone = zoneRef.current;
      if (!zone) return;
      const rect = zone.getBoundingClientRect();
      const cy = rect.top + rect.height / 2;
      const maxR = rect.height / 2;
      let dy = clientY - cy;
      dy = Math.max(-maxR, Math.min(maxR, dy));
      const value = Math.max(-1, Math.min(1, -dy / maxR));
      onChange(value);
    },
    [onChange],
  );

  const handleStart = (e: React.PointerEvent) => {
    if (!enabled) return;
    e.preventDefault();
    pointer.dragging.current = true;
    pointer.pointerIdRef.current = e.pointerId;
    onDragActiveChange?.(true);
    zoneRef.current?.setPointerCapture(e.pointerId);
    updateFromEvent(e.clientY);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!pointer.dragging.current || pointer.pointerIdRef.current !== e.pointerId) return;
    updateFromEvent(e.clientY);
  };

  const handleEnd = (e: React.PointerEvent) => {
    if (pointer.pointerIdRef.current !== e.pointerId) return;
    pointer.releaseCapture(zoneRef.current);
    pointer.onRelease();
  };

  const hitboxCenterOffset = isPortrait
    ? side === "left"
      ? "-5%"
      : "5%"
    : side === "left"
      ? "-2.4%"
      : "2.4%";
  const hitboxWidth = isPortrait ? "11%" : "6.6%";
  const hitboxTopOffset = isPortrait ? "-2%" : "0%";
  const hitboxHeight = isPortrait ? "44%" : "68%";

  return (
    <>
      <div
        ref={zoneRef}
        className={`absolute z-40 touch-none rounded-xl ${!enabled ? "pointer-events-none" : ""}`}
        style={{
          left: `calc(${layout.cx * 100}% + ${hitboxCenterOffset})`,
          top: `calc(${layout.cy * 100}% + ${hitboxTopOffset})`,
          width: hitboxWidth,
          height: hitboxHeight,
          transform: "translate(-50%, -50%)",
        }}
        onPointerDown={handleStart}
        onPointerMove={handleMove}
        onPointerUp={handleEnd}
        onPointerCancel={handleEnd}
        onLostPointerCapture={() => {
          pointer.dragging.current = false;
          pointer.pointerIdRef.current = null;
          releaseTravel();
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
}

function DualTravelCenter({
  layout,
  enabled,
  highlighted,
  showTouchZone,
  isPortrait,
  onChange,
  onDragActiveChange,
}: DualTravelCenterProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const releaseTravel = useCallback(() => {
    onChange(0);
    onDragActiveChange?.(false);
  }, [onChange, onDragActiveChange]);
  const pointer = usePointerRelease(releaseTravel);

  const updateFromEvent = useCallback(
    (clientY: number) => {
      const zone = zoneRef.current;
      if (!zone) return;
      const rect = zone.getBoundingClientRect();
      const cy = rect.top + rect.height / 2;
      const maxR = rect.height / 2;
      const dy = Math.max(-maxR, Math.min(maxR, clientY - cy));
      const value = Math.max(-1, Math.min(1, -dy / maxR));
      onChange(value);
    },
    [onChange],
  );

  const handleStart = (e: React.PointerEvent) => {
    if (!enabled) return;
    e.preventDefault();
    pointer.dragging.current = true;
    pointer.pointerIdRef.current = e.pointerId;
    onDragActiveChange?.(true);
    zoneRef.current?.setPointerCapture(e.pointerId);
    updateFromEvent(e.clientY);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!pointer.dragging.current || pointer.pointerIdRef.current !== e.pointerId) return;
    updateFromEvent(e.clientY);
  };

  const handleEnd = (e: React.PointerEvent) => {
    if (pointer.pointerIdRef.current !== e.pointerId) return;
    pointer.releaseCapture(zoneRef.current);
    pointer.onRelease();
  };

  return (
    <div
      ref={zoneRef}
      className={`absolute z-30 touch-none rounded-xl ${!enabled ? "pointer-events-none" : ""}`}
      style={{
        left: `${layout.cx * 100}%`,
        top: `calc(${layout.cy * 100}% + ${isPortrait ? "-1%" : "0%"})`,
        width: isPortrait ? "12%" : "12.5%",
        height: isPortrait ? "48%" : "68%",
        transform: "translate(-50%, -50%)",
      }}
      onPointerDown={handleStart}
      onPointerMove={handleMove}
      onPointerUp={handleEnd}
      onPointerCancel={handleEnd}
      onLostPointerCapture={() => {
        pointer.dragging.current = false;
        pointer.pointerIdRef.current = null;
        releaseTravel();
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
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? "RPM(x2)" : "RPM(x1)"}
    >
      <span className="yanmar-aux-lever-well" aria-hidden>
        <VisualLever
          cx={cx}
          cy={cy}
          value={active ? 1 : -1}
          color="red"
          variant="hydraulic"
          compact
        />
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
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? "안전(잠금)" : "안전(해제)"}
    >
      <span className="yanmar-aux-lever-well" aria-hidden>
        <VisualLever
          cx={cx}
          cy={cy}
          value={active ? 1 : -0.25}
          color="red"
          variant="safety"
          compact
        />
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
}: {
  value: number;
  enabled: boolean;
  showTouchZone: boolean;
  layout: CockpitLayout;
  isPortrait: boolean;
  onChange: (value: number) => void;
}) {
  const blade = layout.blade;
  const zoneRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  const stickRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const [stick, setStick] = useState(0);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const stopMotion = useCallback(() => {
    stickRef.current = 0;
    setStick(0);
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
      // rate > 0(밀기)=하강, rate < 0(당기기)=상승
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
        stopMotion();
        return;
      }

      frameRef.current = requestAnimationFrame(animate);
    },
    [onChange, stopMotion],
  );

  useEffect(() => stopMotion, [stopMotion]);

  useEffect(() => {
    if (!enabled) stopMotion();
  }, [enabled, stopMotion]);

  const updateFromEvent = useCallback(
    (clientY: number) => {
      const zone = zoneRef.current;
      if (!zone) return;
      const rect = zone.getBoundingClientRect();
      const cy = rect.top + rect.height / 2;
      const maxR = Math.max(rect.height / 2, 1);
      const dy = Math.max(-maxR, Math.min(maxR, clientY - cy));
      // 위(+)=하강, 아래(-)=상승. 중앙 근처는 중립.
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

  const pointer = usePointerRelease(stopMotion);

  const handleStart = (e: React.PointerEvent) => {
    if (!enabled) return;
    e.preventDefault();
    pointer.dragging.current = true;
    pointer.pointerIdRef.current = e.pointerId;
    zoneRef.current?.setPointerCapture(e.pointerId);
    updateFromEvent(e.clientY);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!pointer.dragging.current || pointer.pointerIdRef.current !== e.pointerId) return;
    updateFromEvent(e.clientY);
  };

  const handleEnd = (e: React.PointerEvent) => {
    if (pointer.pointerIdRef.current !== e.pointerId) return;
    pointer.releaseCapture(zoneRef.current);
    pointer.onRelease();
  };

  return (
    <>
      <div
        className={`yanmar-blade-lever-visual pointer-events-none absolute z-30 ${
          !enabled ? "is-disabled" : ""
        }`}
        style={{
          left: `${blade.cx * 100}%`,
          top: `${blade.cy * 100}%`,
          transform: "translate(-50%, -50%)",
        }}
        aria-hidden
      >
        <VisualLever
          cx={0.5}
          cy={0.42}
          value={stick}
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
          top: `calc(${blade.cy * 100}% + ${isPortrait ? "-2%" : "0%"})`,
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
          pointer.dragging.current = false;
          pointer.pointerIdRef.current = null;
          stopMotion();
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

function PedalSwingControl({
  activeValue,
  showTouchZone,
  onChange,
  layout,
  isPortrait,
  embedded = false,
}: {
  activeValue: number;
  showTouchZone: boolean;
  onChange: (value: number) => void;
  layout: CockpitLayout;
  isPortrait: boolean;
  embedded?: boolean;
}) {
  const pedal = layout.rightPedal;
  const touchCx = embedded ? pedal.cx : isPortrait ? pedal.cx : pedal.cx + 0.03;
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

  const topPressAmount = Math.max(0, activeValue);
  const bottomPressAmount = Math.max(0, -activeValue);
  const pedalSizeStyle = embedded
    ? { width: "100%", height: "100%" }
    : isPortrait
      ? { width: "2.85rem", height: "4.55rem" }
      : { width: "2.55rem", height: "5rem" };

  return (
    <div
      className={`yanmar-pedal-button select-none ${
        embedded ? "relative h-full w-full" : "absolute z-40"
      } ${
        pressedDirection > 0 ? "is-top-active" : pressedDirection < 0 ? "is-bottom-active" : ""
      } ${isPortrait ? "yanmar-pedal-button-portrait" : ""}`}
      style={{
        WebkitTouchCallout: "none",
        ...(embedded
          ? pedalSizeStyle
          : {
              left: `${touchCx * 100}%`,
              top: `${pedal.cy * 100}%`,
              ...pedalSizeStyle,
              transform: "translate(-50%, -50%)",
            }),
      }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="우측 페달 붐 스윙"
    >
      {embedded && (
        <span className="yanmar-visual-pedal-nested pointer-events-none" aria-hidden>
          <span
            className="yanmar-pedal-pad"
            style={{
              transform: `translate(-50%, calc(-50% + ${(topPressAmount - bottomPressAmount) * 0.12}rem))`,
            }}
          />
        </span>
      )}
      {showTouchZone && (
        <div className="pointer-events-none absolute inset-0 rounded-lg border border-amber-200/65 bg-transparent">
          <span className="absolute inset-x-[8%] top-[6%] h-[42%] rounded-t-lg border border-amber-100/35" />
          <span className="absolute inset-x-[8%] bottom-[6%] h-[42%] rounded-b-lg border border-amber-100/35" />
        </div>
      )}
      <button
        type="button"
        className="yanmar-pedal-button-half yanmar-pedal-button-top absolute inset-x-[8%] top-[6%] h-[42%] rounded-t-lg transition-transform duration-300 ease-out"
        style={{
          transform: `translateY(${topPressAmount * 0.35}rem) scale(${1 - topPressAmount * 0.03})`,
        }}
        onPointerDown={(e) => press(e, 1)}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={handleLostCapture}
        onContextMenu={(e) => e.preventDefault()}
        aria-pressed={pressedDirection > 0}
        aria-label="우측 페달 위쪽: 암 우측 회전"
      />
      <button
        type="button"
        className="yanmar-pedal-button-half yanmar-pedal-button-bottom absolute inset-x-[8%] bottom-[6%] h-[42%] rounded-b-lg transition-transform duration-300 ease-out"
        style={{
          transform: `translateY(${-bottomPressAmount * 0.35}rem) scale(${1 - bottomPressAmount * 0.03})`,
        }}
        onPointerDown={(e) => press(e, -1)}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={handleLostCapture}
        onContextMenu={(e) => e.preventDefault()}
        aria-pressed={pressedDirection < 0}
        aria-label="우측 페달 아래쪽: 암 좌측 회전"
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
  onSelect,
}: {
  type: AttachmentType;
  label: string;
  icon: string;
  selected: boolean;
  playerLevel: number;
  onSelect: () => void;
}) {
  const unlocked = isAttachmentUnlocked(type, playerLevel);
  const requiredLevel = getAttachmentRequiredLevel(type);
  return (
    <button
      type="button"
      className={`yanmar-attachment-button${selected ? " is-selected" : ""}${
        unlocked ? "" : " is-locked"
      }`}
      onClick={onSelect}
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
  onAttachmentChange,
}: FunctionMenuProps) {
  const anchorCx = layout.left.cx;
  const toggleCy = AUX_MENU_TOGGLE_CY;
  const buttonSize = isPortrait ? "2.85rem" : "2.75rem";
  const gap = "0.42rem";
  const pedalHeight = `calc(${buttonSize} * 2 + ${gap})`;

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
          className="yanmar-function-menu-item yanmar-function-menu-item-pedal"
          style={{
            width: buttonSize,
            height: pedalHeight,
            transitionDelay: `${
              expanded
                ? FUNCTION_MENU_OPEN_DELAYS_MS.pedal
                : FUNCTION_MENU_CLOSE_DELAYS_MS.pedal
            }ms`,
          }}
        >
          <PedalSwingControl
            activeValue={auxiliary.boomSwing}
            showTouchZone={showTouchZones}
            layout={layout}
            isPortrait={isPortrait}
            embedded
            onChange={(boomSwing) =>
              onAuxiliaryChange((current) => ({ ...current, boomSwing }))
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
        onClick={onToggle}
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
  active = false,
  disabled = false,
  onClick,
  showTouchZone,
  ariaLabel,
}: {
  variant: "save" | "execute";
  slot: AutoPoseSlotIndex;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  showTouchZone: boolean;
  ariaLabel: string;
}) {
  const label = variant === "save" ? `저장${slot + 1}` : `실행${slot + 1}`;

  return (
    <button
      type="button"
      className={`yanmar-auto-menu-action yanmar-aux-button relative h-full w-full touch-none active:scale-95${
        active ? " is-active" : ""
      }${disabled ? " is-disabled" : ""}`}
      onClick={onClick}
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

interface AutoMenuProps {
  expanded: boolean;
  onToggle: () => void;
  layout: CockpitLayout;
  isPortrait: boolean;
  showTouchZones: boolean;
  autoPose: AutoPoseState;
  onSavePose: (slot: AutoPoseSlotIndex) => void;
  onExecutePose: (slot: AutoPoseSlotIndex) => void;
  savePoseDisabled?: boolean;
  executePoseDisabled?: boolean;
}

function AutoMenu({
  expanded,
  onToggle,
  layout,
  isPortrait,
  showTouchZones,
  autoPose,
  onSavePose,
  onExecutePose,
  savePoseDisabled = false,
  executePoseDisabled = false,
}: AutoMenuProps) {
  const anchorCx = layout.horn.cx;
  const toggleCy = AUX_MENU_TOGGLE_CY;
  const buttonSize = isPortrait ? "2.85rem" : "2.75rem";

  return (
    <div
      className="yanmar-auto-menu"
      style={{
        left: `${anchorCx * 100}%`,
        top: `${toggleCy * 100}%`,
      }}
    >
      <div className={`yanmar-auto-menu-items ${expanded ? "is-expanded" : ""}`}>
        {AUTO_POSE_SLOT_ORDER.map((slot, index) => {
          const openDelayMs = index * 50;
          const closeDelayMs = (AUTO_POSE_SLOT_ORDER.length - 1 - index) * 35;
          const hasSavedPose = autoPose.slots[slot] != null;
          const isExecutingThis =
            autoPose.executing && autoPose.activeSlot === slot;

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
                    active={isExecutingThis}
                    disabled={!hasSavedPose || autoPose.executing || executePoseDisabled}
                    onClick={() => onExecutePose(slot)}
                    showTouchZone={showTouchZones}
                    ariaLabel={
                      executePoseDisabled
                        ? `슬롯 ${slot + 1} 자세 실행 대기 중`
                        : isExecutingThis
                          ? `슬롯 ${slot + 1} 자동 자세 실행 중`
                          : `슬롯 ${slot + 1} 저장된 자세 실행`
                    }
                  />
                </div>
                <div style={{ width: buttonSize, height: buttonSize }}>
                  <AutoMenuActionButton
                    variant="save"
                    slot={slot}
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
      </div>

      <button
        type="button"
        className={`yanmar-auto-menu-toggle yanmar-aux-button touch-none active:scale-95${
          expanded ? " is-expanded" : ""
        }${isPortrait ? " yanmar-aux-button-portrait yanmar-auto-menu-toggle-portrait" : ""}`}
        style={{
          width: buttonSize,
          height: buttonSize,
        }}
        onClick={onToggle}
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
  input,
  onInputChange,
  auxiliary,
  onAuxiliaryChange,
  allowed,
  tutorialStep,
  showTouchZones,
  hideVisualDeck = false,
  autoPose,
  onSavePose,
  onExecutePose,
  savePoseDisabled = false,
  executePoseDisabled = false,
  attachmentType,
  playerLevel,
  onAttachmentChange,
}: CockpitOverlayProps) {
  const highlightLeft =
    tutorialStep?.highlight === "left" || tutorialStep?.highlight === "both";
  const highlightRight =
    tutorialStep?.highlight === "right" || tutorialStep?.highlight === "both";
  const highlightTravel = tutorialStep?.highlight === "travel";
  const layout = PORTRAIT_COCKPIT_LAYOUT;
  const isPortrait = true;
  const [functionMenuExpanded, setFunctionMenuExpanded] = useState(false);
  const [autoMenuExpanded, setAutoMenuExpanded] = useState(false);
  /** 한쪽 주행 레버(또는 중앙 동시) 조작 중에는 다른 주행 입력을 잠근다. */
  const [travelLock, setTravelLock] = useState<"left" | "right" | "both" | null>(null);
  const travelEnabled = allowed.travel && !auxiliary.safetyLocked;

  useEffect(() => {
    if (!travelEnabled) setTravelLock(null);
  }, [travelEnabled]);

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
            />
          ) : null}
        </div>
      </div>

      <div className="yanmar-control-deck yanmar-control-touch-layer absolute inset-x-0 z-20 mx-auto touch-none">
        <div className="relative h-full w-full">
          <TravelLever
            side="left"
            layout={layout.travelLeft}
            enabled={travelEnabled && (travelLock === null || travelLock === "left")}
            highlighted={highlightTravel}
            showTouchZone={showTouchZones}
            isPortrait={isPortrait}
            onDragActiveChange={(active) =>
              setTravelLock((current) => {
                if (active) return "left";
                return current === "left" ? null : current;
              })
            }
            onChange={(left) =>
              onInputChange((current) => ({
                ...current,
                travel: { left, right: 0 },
              }))
            }
          />
          <TravelLever
            side="right"
            layout={layout.travelRight}
            enabled={travelEnabled && (travelLock === null || travelLock === "right")}
            highlighted={highlightTravel}
            showTouchZone={showTouchZones}
            isPortrait={isPortrait}
            onDragActiveChange={(active) =>
              setTravelLock((current) => {
                if (active) return "right";
                return current === "right" ? null : current;
              })
            }
            onChange={(right) =>
              onInputChange((current) => ({
                ...current,
                travel: { left: 0, right },
              }))
            }
          />
          <BladeLever
            value={auxiliary.blade}
            enabled={!auxiliary.safetyLocked}
            showTouchZone={showTouchZones}
            layout={layout}
            isPortrait={isPortrait}
            onChange={(blade) =>
              onAuxiliaryChange((current) => ({ ...current, blade }))
            }
          />
          <DualTravelCenter
            layout={layout.travelBoth}
            enabled={travelEnabled && (travelLock === null || travelLock === "both")}
            highlighted={highlightTravel}
            showTouchZone={showTouchZones}
            isPortrait={isPortrait}
            onDragActiveChange={(active) =>
              setTravelLock((current) => {
                if (active) return "both";
                return current === "both" ? null : current;
              })
            }
            onChange={(value) =>
              onInputChange((current) => ({
                ...current,
                travel: { left: value, right: value },
              }))
            }
          />
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
            onAttachmentChange={onAttachmentChange}
          />
          <AutoMenu
            expanded={autoMenuExpanded}
            onToggle={() => setAutoMenuExpanded((open) => !open)}
            layout={layout}
            isPortrait={isPortrait}
            showTouchZones={showTouchZones}
            autoPose={autoPose}
            onSavePose={onSavePose}
            onExecutePose={onExecutePose}
            savePoseDisabled={savePoseDisabled}
            executePoseDisabled={executePoseDisabled}
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
            onChange={(x, y) =>
              onInputChange((current) => ({ ...current, right: { x, y } }))
            }
          />
          <HornTouchZone
            layout={layout.right}
            isPortrait={isPortrait}
            showTouchZone={showTouchZones}
            onHorn={playHorn}
          />
        </div>
      </div>
    </>
  );
}
