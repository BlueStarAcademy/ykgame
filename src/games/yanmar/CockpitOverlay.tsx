"use client";

/* eslint-disable react-hooks/immutability */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AuxiliaryControlState,
  ControlMask,
  ExcavatorControlState,
} from "./controls";
import { COCKPIT_LAYOUT } from "./controls";
import type { TutorialStep } from "./tutorial";

export type CockpitLayoutMode = "portrait" | "landscape";

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
  layoutMode: CockpitLayoutMode;
}

interface JoystickLayout {
  cx: number;
  cy: number;
  radius: number;
  travel: number;
}

const PEDAL_SWING_SPEED_PER_SECOND = 0.85;

/** `as const` layout literals widened so portrait offsets type-check. */
type WidenNumbers<T> = T extends number
  ? number
  : T extends object
    ? { -readonly [K in keyof T]: WidenNumbers<T[K]> }
    : T;
type CockpitLayout = WidenNumbers<typeof COCKPIT_LAYOUT>;

const PORTRAIT_COCKPIT_LAYOUT: CockpitLayout = {
  ...COCKPIT_LAYOUT,
  left: { ...COCKPIT_LAYOUT.left, cx: 0.13, cy: 0.91 },
  right: { ...COCKPIT_LAYOUT.right, cx: 0.87, cy: 0.91 },
  safetyLever: { ...COCKPIT_LAYOUT.safetyLever, cx: 0.11, cy: 0.46 },
  travelLeft: { ...COCKPIT_LAYOUT.travelLeft, cx: 0.455, cy: 0.91 },
  travelRight: { ...COCKPIT_LAYOUT.travelRight, cx: 0.545, cy: 0.91 },
  travelBoth: { ...COCKPIT_LAYOUT.travelBoth, cx: 0.5, cy: 0.91 },
  // Right column top→bottom: pedal → horn → hydraulic → stick (extra gap around horn)
  hydraulicSpeed: { ...COCKPIT_LAYOUT.hydraulicSpeed, cx: 0.89, cy: 0.52 },
  rightPedal: { ...COCKPIT_LAYOUT.rightPedal, cx: 0.89, cy: 0.18 },
  horn: { ...COCKPIT_LAYOUT.horn, cx: 0.89, cy: 0.35 },
};

function useControlLayout(layoutMode: CockpitLayoutMode) {
  const isPortrait = layoutMode === "portrait";
  return {
    isPortrait,
    layout: isPortrait ? PORTRAIT_COCKPIT_LAYOUT : COCKPIT_LAYOUT,
  };
}

function VisualJoystick({
  side,
  value,
  highlighted,
  layout,
}: {
  side: "left" | "right";
  value: { x: number; y: number };
  highlighted: boolean;
  layout: CockpitLayout;
}) {
  const x = Math.max(-1, Math.min(1, value.x));
  const y = Math.max(-1, Math.min(1, value.y));
  const visualX = side === "right" ? -x : x;
  const visualY = side === "right" ? -y : y;
  const pullDepth = Math.max(0, -y);
  const pushDepth = Math.max(0, y);
  const stickDrop = pullDepth * 0.42 - pushDepth * 0.22;
  const bootDrop = pullDepth * 0.18 - pushDepth * 0.12;
  const bootScaleY = 1 - pullDepth * 0.08 + pushDepth * 0.08;
  return (
    <div
      className={`yanmar-visual-part yanmar-visual-joystick yanmar-visual-joystick-${side} ${
        highlighted ? "yanmar-visual-highlight" : ""
      }`}
      style={{
        left: `${layout[side].cx * 100}%`,
        top: `${(layout[side].cy - 0.08) * 100}%`,
      }}
    >
      <div className="yanmar-realstick">
        <div className="yanmar-realstick-base" />
        <div
          className="yanmar-realstick-boot"
          style={{
            transform: `translate3d(-50%, ${bootDrop}rem, 0) rotate(${-visualX * 3.5}deg) scaleY(${bootScaleY})`,
          }}
        >
          <span />
          <span />
          <span />
          <span />
        </div>
        <div
          className="yanmar-realstick-upper"
          style={{
            transform: `translate3d(-50%, ${stickDrop}rem, 0) rotate(${-visualX * 12}deg) skewX(${visualY * -2}deg)`,
          }}
        >
          <span className="yanmar-realstick-stem" />
          <span className="yanmar-realstick-collar" />
          <span className="yanmar-realstick-grip">
            <span className="yanmar-realstick-cap" />
            <span className="yanmar-realstick-face" />
            <span className="yanmar-realstick-side" />
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
  const stickDrop = compact
    ? pullDepth * 0.1 - pushDepth * 0.04
    : pullDepth * 0.42 - pushDepth * 0.12;
  const bendX = compact
    ? v >= 0
      ? v * -8
      : v * -14
    : v >= 0
      ? v * -22
      : v * -48;
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
            transform: `translateX(-50%) translateY(${stickDrop}rem) rotateX(${bendX}deg)`,
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
  isPortrait = false,
  nested = false,
}: {
  value: number;
  layout: CockpitLayout;
  isPortrait?: boolean;
  /** When true, fills parent panel well instead of absolute deck coords */
  nested?: boolean;
}) {
  const top = Math.max(0, value);
  const bottom = Math.max(0, -value);
  const pedal = layout.rightPedal;
  const pressOffset = (top - bottom) * (nested ? 0.1 : 0.22);
  return (
    <div
      className={`yanmar-visual-part yanmar-visual-pedal${
        nested ? " yanmar-visual-pedal-nested" : ""
      }`}
      style={
        nested
          ? undefined
          : {
              left: `${(pedal.cx + (isPortrait ? 0 : 0.03)) * 100}%`,
              top: `${pedal.cy * 100}%`,
            }
      }
    >
      <div
        className="yanmar-pedal-pad"
        style={{
          transform: nested
            ? `translate(-50%, calc(-50% + ${pressOffset}rem))`
            : `translate(-50%, ${pressOffset}rem)`,
        }}
      />
    </div>
  );
}

function VisualSafetyLockStatus({ locked }: { locked: boolean }) {
  return (
    <div className={`yanmar-safety-lock-status ${locked ? "is-locked" : "is-unlocked"}`}>
      <span className="yanmar-safety-lock-icon" aria-hidden>
        {locked ? "🔒" : "🔓"}
      </span>
      <span>{locked ? "잠김" : "해제"}</span>
    </div>
  );
}

function VisualHydraulicSpeedStatus({ highSpeed }: { highSpeed: boolean }) {
  return (
    <div className={`yanmar-hydraulic-speed-status ${highSpeed ? "is-high" : "is-low"}`}>
      {highSpeed ? "x2" : "x1"}
    </div>
  );
}

function VisualPortraitSideButtons({
  auxiliary,
  layout,
}: {
  auxiliary: AuxiliaryControlState;
  layout: CockpitLayout;
}) {
  const pedal = layout.rightPedal;
  return (
    <>
      <div
        className={`yanmar-portrait-3d-button yanmar-portrait-3d-button-safety ${
          auxiliary.safetyLocked ? "is-active" : ""
        }`}
        style={{
          left: `${layout.safetyLever.cx * 100}%`,
          top: `${layout.safetyLever.cy * 100}%`,
        }}
      >
        <div className="yanmar-portrait-3d-well">
          <VisualLever
            cx={layout.safetyLever.cx}
            cy={layout.safetyLever.cy}
            value={auxiliary.safetyLocked ? 1 : -0.25}
            color="red"
            variant="safety"
            compact
          />
        </div>
        <span className="yanmar-portrait-status-label">
          {auxiliary.safetyLocked ? "잠김" : "해제"}
        </span>
      </div>
      <div
        className="yanmar-portrait-3d-button yanmar-portrait-3d-button-pedal"
        style={{
          left: `${pedal.cx * 100}%`,
          top: `${pedal.cy * 100}%`,
        }}
      >
        <div className="yanmar-portrait-3d-well">
          <VisualPedal
            value={auxiliary.boomSwing}
            layout={layout}
            isPortrait
            nested
          />
        </div>
      </div>
      <div
        className={`yanmar-portrait-3d-button yanmar-portrait-3d-button-hydraulic ${
          auxiliary.highSpeed ? "is-active" : ""
        }`}
        style={{
          left: `${layout.hydraulicSpeed.cx * 100}%`,
          top: `${layout.hydraulicSpeed.cy * 100}%`,
        }}
      >
        <div className="yanmar-portrait-3d-well">
          <VisualLever
            cx={layout.hydraulicSpeed.cx}
            cy={layout.hydraulicSpeed.cy}
            value={auxiliary.highSpeed ? 1 : -1}
            color="red"
            variant="hydraulic"
            compact
          />
        </div>
        <span className="yanmar-portrait-status-label">
          {auxiliary.highSpeed ? "x2" : "x1"}
        </span>
      </div>
    </>
  );
}

function VisualControlDeck({
  input,
  auxiliary,
  highlightLeft,
  highlightRight,
  highlightTravel,
  layout,
  isPortrait,
}: {
  input: ExcavatorControlState;
  auxiliary: AuxiliaryControlState;
  highlightLeft: boolean;
  highlightRight: boolean;
  highlightTravel: boolean;
  layout: CockpitLayout;
  isPortrait: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="yanmar-bottom-connector" />
      <VisualJoystick side="left" value={input.left} highlighted={highlightLeft} layout={layout} />
      {isPortrait ? (
        <VisualPortraitSideButtons auxiliary={auxiliary} layout={layout} />
      ) : (
        <>
          <VisualLever
            cx={layout.safetyLever.cx}
            cy={layout.safetyLever.cy}
            value={auxiliary.safetyLocked ? 1 : -0.25}
            color="red"
            variant="safety"
          />
          <VisualSafetyLockStatus locked={auxiliary.safetyLocked} />
        </>
      )}
      <VisualTravelLevers
        left={input.travel.left}
        right={input.travel.right}
        highlighted={highlightTravel}
        layout={layout}
      />
      {isPortrait ? null : (
        <>
          <VisualLever
            cx={layout.hydraulicSpeed.cx}
            cy={layout.hydraulicSpeed.cy}
            value={auxiliary.highSpeed ? 1 : -1}
            color="red"
            variant="hydraulic"
          />
          <VisualHydraulicSpeedStatus highSpeed={auxiliary.highSpeed} />
          <VisualPedal value={auxiliary.boomSwing} layout={layout} />
        </>
      )}
      <VisualJoystick side="right" value={input.right} highlighted={highlightRight} layout={layout} />
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
          top: `${(layout.cy - 0.08) * 100}%`,
          width: isPortrait ? "18%" : "13.2%",
          height: isPortrait ? "38%" : "54%",
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
          <>
            <div
              className={`pointer-events-none absolute inset-0 rounded-2xl border ${
                side === "left"
                  ? "border-red-200/65"
                  : "border-sky-200/65"
              } bg-transparent`}
            />
          </>
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
}

function TravelLever({
  side,
  layout,
  enabled,
  highlighted,
  showTouchZone,
  isPortrait,
  onChange,
}: TravelLeverProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const pointer = usePointerRelease(() => onChange(0));

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
      ? "-7.5%"
      : "7.5%"
    : side === "left"
      ? "-2.4%"
      : "2.4%";
  const hitboxWidth = isPortrait ? "12%" : "6.6%";
  const hitboxTopOffset = isPortrait ? "-1%" : "0%";
  const hitboxHeight = isPortrait ? "48%" : "68%";

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
          onChange(0);
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
}

function DualTravelCenter({
  layout,
  enabled,
  highlighted,
  showTouchZone,
  isPortrait,
  onChange,
}: DualTravelCenterProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const pointer = usePointerRelease(() => onChange(0));

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
        onChange(0);
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

function SpeedModeLever({
  active,
  cx,
  cy,
  showTouchZone,
  onToggle,
  isPortrait,
}: {
  active: boolean;
  cx: number;
  cy: number;
  showTouchZone: boolean;
  onToggle: () => void;
  isPortrait: boolean;
}) {
  const hitboxWidth = isPortrait ? "12.5%" : "4.6%";

  return (
    <button
      type="button"
      className="absolute z-40 touch-none active:scale-[0.98]"
      style={{
        left: `${cx * 100}%`,
        top: `${cy * 100}%`,
        width: hitboxWidth,
        height: isPortrait ? "8%" : "44%",
        transform: "translate(-50%, -50%)",
      }}
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? "유압 속도 x2" : "유압 속도 x1"}
    >
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
}: {
  active: boolean;
  cx: number;
  cy: number;
  showTouchZone: boolean;
  onToggle: () => void;
  isPortrait: boolean;
}) {
  return (
    <button
      type="button"
      className="absolute z-50 touch-none active:scale-[0.98]"
      style={{
        left: `${cx * 100}%`,
        top: `${cy * 100}%`,
        width: isPortrait ? "12.5%" : "5.2%",
        height: isPortrait ? "8%" : "48%",
        transform: "translate(-50%, -50%)",
      }}
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? "안전레버 잠김" : "안전레버 해제"}
    >
      {showTouchZone && (
        <span className="pointer-events-none absolute inset-[-6%] rounded-xl border border-red-200/65 bg-transparent" />
      )}
    </button>
  );
}

function HornButton({
  layout,
  isPortrait,
  showTouchZone,
}: {
  layout: CockpitLayout;
  isPortrait: boolean;
  showTouchZone: boolean;
}) {
  const cx = isPortrait ? layout.horn.cx : layout.right.cx;
  const cy = isPortrait ? layout.horn.cy : Math.max(0.28, layout.right.cy - 0.49);

  return (
    <button
      type="button"
      className={`yanmar-horn-button absolute touch-none active:scale-95${
        isPortrait ? " yanmar-horn-button-portrait" : ""
      }`}
      style={{
        left: `${cx * 100}%`,
        top: `${cy * 100}%`,
        transform: "translate(-50%, -50%)",
      }}
      onClick={playHorn}
      aria-label="경적"
    >
      <span className="yanmar-horn-button-dot" />
      {showTouchZone ? (
        <span className="pointer-events-none absolute inset-[-8%] rounded-md border border-yellow-200/70 bg-transparent" />
      ) : null}
    </button>
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
  const touchCx = isPortrait ? pedal.cx : pedal.cx + 0.03;
  const valueRef = useRef(activeValue);
  const directionRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);

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
    stopAnimation();
  };

  const handleLostCapture = () => {
    stopAnimation();
  };

  const topPressAmount = Math.max(0, activeValue);
  const bottomPressAmount = Math.max(0, -activeValue);
  return (
    <div
      className="absolute z-40 select-none"
      style={{
        left: `${touchCx * 100}%`,
        ...(isPortrait
          ? {
              top: `calc(${pedal.cy * 100}% - 0.75%)`,
              width: "12.5%",
              height: "9%",
              transform: "translate(-50%, -50%)",
            }
          : {
              bottom: 0,
              width: `${pedal.width * 100}%`,
              height: `${pedal.height * 100}%`,
              transform: "translateX(-50%)",
            }),
        WebkitTouchCallout: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="우측 페달 붐 스윙"
    >
      {showTouchZone && (
        <div className="pointer-events-none absolute inset-0 rounded-lg border border-amber-200/65 bg-transparent">
          <span className="absolute inset-x-[8%] top-[7%] h-[43%] rounded-t-lg border border-amber-100/35" />
          <span className="absolute inset-x-[8%] bottom-[7%] h-[43%] rounded-b-lg border border-amber-100/35" />
        </div>
      )}
      <button
        type="button"
        className="absolute inset-x-[8%] top-[7%] h-[43%] rounded-t-lg bg-transparent transition-transform duration-300 ease-out"
        style={{
          transform: `translateY(${topPressAmount * 0.35}rem) scale(${1 - topPressAmount * 0.03})`,
        }}
        onPointerDown={(e) => press(e, 1)}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={handleLostCapture}
        onContextMenu={(e) => e.preventDefault()}
        aria-pressed={activeValue > 0}
        aria-label="우측 페달 위쪽: 암 우측 회전"
      />
      <button
        type="button"
        className="absolute inset-x-[8%] bottom-[7%] h-[43%] rounded-b-lg bg-transparent transition-transform duration-300 ease-out"
        style={{
          transform: `translateY(${-bottomPressAmount * 0.35}rem) scale(${1 - bottomPressAmount * 0.03})`,
        }}
        onPointerDown={(e) => press(e, -1)}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={handleLostCapture}
        onContextMenu={(e) => e.preventDefault()}
        aria-pressed={activeValue < 0}
        aria-label="우측 페달 아래쪽: 암 좌측 회전"
      />
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
  layoutMode,
}: CockpitOverlayProps) {
  const highlightLeft =
    tutorialStep?.highlight === "left" || tutorialStep?.highlight === "both";
  const highlightRight =
    tutorialStep?.highlight === "right" || tutorialStep?.highlight === "both";
  const highlightTravel = tutorialStep?.highlight === "travel";
  const { layout, isPortrait } = useControlLayout(layoutMode);

  return (
    <>
      <div className="yanmar-control-deck pointer-events-none absolute inset-x-0 z-10 mx-auto">
        <div className="relative h-full w-full">
          <VisualControlDeck
            input={input}
            auxiliary={auxiliary}
            highlightLeft={highlightLeft}
            highlightRight={highlightRight}
            highlightTravel={highlightTravel}
            layout={layout}
            isPortrait={isPortrait}
          />
        </div>
      </div>

      <div className="yanmar-control-deck yanmar-control-touch-layer absolute inset-x-0 z-20 mx-auto touch-none">
        <div className="relative h-full w-full">
          <TravelLever
            side="left"
            layout={layout.travelLeft}
            enabled={allowed.travel && !auxiliary.safetyLocked}
            highlighted={highlightTravel}
            showTouchZone={showTouchZones}
            isPortrait={isPortrait}
            onChange={(left) =>
              onInputChange((current) => ({
                ...current,
                travel: { ...current.travel, left },
              }))
            }
          />
          <TravelLever
            side="right"
            layout={layout.travelRight}
            enabled={allowed.travel && !auxiliary.safetyLocked}
            highlighted={highlightTravel}
            showTouchZone={showTouchZones}
            isPortrait={isPortrait}
            onChange={(right) =>
              onInputChange((current) => ({
                ...current,
                travel: { ...current.travel, right },
              }))
            }
          />
          <DualTravelCenter
            layout={layout.travelBoth}
            enabled={allowed.travel && !auxiliary.safetyLocked}
            highlighted={highlightTravel}
            showTouchZone={showTouchZones}
            isPortrait={isPortrait}
            onChange={(value) =>
              onInputChange((current) => ({
                ...current,
                travel: { left: value, right: value },
              }))
            }
          />
          <PedalSwingControl
            activeValue={auxiliary.boomSwing}
            showTouchZone={showTouchZones}
            layout={layout}
            isPortrait={isPortrait}
            onChange={(boomSwing) => onAuxiliaryChange((current) => ({ ...current, boomSwing }))}
          />
          <SpeedModeLever
            cx={layout.hydraulicSpeed.cx}
            cy={layout.hydraulicSpeed.cy}
            active={auxiliary.highSpeed}
            showTouchZone={showTouchZones}
            isPortrait={isPortrait}
            onToggle={() =>
              onAuxiliaryChange((current) => ({ ...current, highSpeed: !current.highSpeed }))
            }
          />
          <SafetyLever
            cx={layout.safetyLever.cx}
            cy={layout.safetyLever.cy}
            active={auxiliary.safetyLocked}
            showTouchZone={showTouchZones}
            isPortrait={isPortrait}
            onToggle={() =>
              onAuxiliaryChange({
                ...auxiliary,
                safetyLocked: !auxiliary.safetyLocked,
              })
            }
          />
          <HornButton layout={layout} isPortrait={isPortrait} showTouchZone={showTouchZones} />
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
        </div>
      </div>
    </>
  );
}
