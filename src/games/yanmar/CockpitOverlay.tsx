"use client";

/* eslint-disable react-hooks/immutability */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AuxiliaryControlState,
  ControlMask,
  ExcavatorControlState,
} from "./controls";
import { COCKPIT_LAYOUT, YANMAR_ASSETS } from "./controls";
import type { TutorialStep } from "./tutorial";

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
}

interface JoystickLayout {
  cx: number;
  cy: number;
  radius: number;
  travel: number;
}

interface HornLayout {
  cx: number;
  cy: number;
  radius: number;
}

type AxisValue = { x: number; y: number };

const PEDAL_SWING_SPEED_PER_SECOND = 0.85;

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
  value: AxisValue;
  enabled: { x: boolean; y: boolean };
  highlighted: boolean;
  showTouchZone: boolean;
  onChange: (x: number, y: number) => void;
  hornLayout?: HornLayout;
}

function GameJoystick({
  side,
  layout,
  value,
  enabled,
  highlighted,
  showTouchZone,
  onChange,
  hornLayout,
}: GameJoystickProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const pointer = usePointerRelease(() => onChange(0, 0));
  const tapStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

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
    setActive(true);
    pointer.pointerIdRef.current = e.pointerId;
    tapStartRef.current = { x: e.clientX, y: e.clientY, time: performance.now() };
    zoneRef.current?.setPointerCapture(e.pointerId);
    updateFromEvent(e.clientX, e.clientY);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!pointer.dragging.current || pointer.pointerIdRef.current !== e.pointerId) return;
    updateFromEvent(e.clientX, e.clientY);
  };

  const handleEnd = (e: React.PointerEvent) => {
    if (pointer.pointerIdRef.current !== e.pointerId) return;
    const tapStart = tapStartRef.current;
    if (hornLayout && e.type === "pointerup" && tapStart) {
      const dx = e.clientX - tapStart.x;
      const dy = e.clientY - tapStart.y;
      const elapsed = performance.now() - tapStart.time;
      if (elapsed < 260 && Math.sqrt(dx * dx + dy * dy) < 10) {
        playHorn();
      }
    }
    tapStartRef.current = null;
    pointer.releaseCapture(zoneRef.current);
    setActive(false);
    pointer.onRelease();
  };

  const visualX = value.x * layout.travel * 48;
  const visualY = -value.y * layout.travel * 42;
  const leanX = value.x * 16;
  const leanY = value.y * 11;
  const isDisabled = !enabled.x && !enabled.y;

  return (
    <>
      <div
        ref={zoneRef}
        className={`absolute z-50 touch-none rounded-2xl ${isDisabled ? "pointer-events-none" : ""}`}
        style={{
          left: `${layout.cx * 100}%`,
          top: `${layout.cy * 100}%`,
          width: "12%",
          height: "34%",
          transform: "translate(-50%, -50%)",
        }}
        onPointerDown={handleStart}
        onPointerMove={handleMove}
        onPointerUp={handleEnd}
        onPointerCancel={handleEnd}
        onLostPointerCapture={() => {
          pointer.dragging.current = false;
          pointer.pointerIdRef.current = null;
          tapStartRef.current = null;
          setActive(false);
          onChange(0, 0);
        }}
        aria-label={side === "left" ? "좌 조이스틱" : "우 조이스틱"}
      >
        {showTouchZone && (
          <div
            className={`pointer-events-none absolute inset-0 rounded-2xl border ${
              side === "left"
                ? "border-red-200/35 bg-red-400/[0.01]"
                : "border-sky-200/35 bg-sky-400/[0.01]"
            } shadow-[inset_0_0_18px_rgba(255,255,255,0.01)] backdrop-blur-[1px]`}
          />
        )}
        {highlighted && (
          <div className="yanmar-joystick-highlight absolute inset-[-10%] rounded-full border-2 border-amber-300/95 bg-amber-300/10" />
        )}
        {isDisabled && (
          <div className="absolute inset-0 rounded-2xl bg-black/20" />
        )}
      </div>

      <div
        className="pointer-events-none absolute z-[55]"
        style={{
          left: `${layout.cx * 100}%`,
          top: `calc(${layout.cy * 100}% + ${visualY}%)`,
          width: "10.2%",
          height: "30.5%",
          transform: `translate(calc(-50% + ${visualX}%), -50%) rotateX(${leanY}deg) rotateZ(${leanX}deg)`,
          transformOrigin: "50% 92%",
          transition: active ? "none" : "left 120ms ease, top 120ms ease, transform 120ms ease",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/images/yanmar/main-joystick-${side}.png`}
          alt=""
          className="h-full w-full object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,0.45)]"
          draggable={false}
          aria-hidden
        />
      </div>
    </>
  );
}

interface TravelLeverProps {
  side: "left" | "right";
  layout: JoystickLayout;
  value: number;
  enabled: boolean;
  highlighted: boolean;
  showTouchZone: boolean;
  onChange: (value: number) => void;
}

function TravelLever({
  side,
  layout,
  value,
  enabled,
  highlighted,
  showTouchZone,
  onChange,
}: TravelLeverProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
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
    setActive(true);
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
    setActive(false);
    pointer.onRelease();
  };

  const hitboxCenterOffset = side === "left" ? "-6.4%" : "6.4%";
  const hitboxWidth = "12.8%";
  const hitboxTopOffset = "-8%";
  const hitboxHeight = "32%";
  const knobY = -value * layout.travel * 145;

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
          setActive(false);
          onChange(0);
        }}
        aria-label="주행 레버"
      >
        {showTouchZone && (
          <>
            <div
              className={`pointer-events-none absolute inset-0 rounded-xl border ${
                side === "left"
                  ? "border-sky-200/35 bg-sky-400/[0.01]"
                  : "border-violet-200/35 bg-violet-400/[0.01]"
              } shadow-[inset_0_0_14px_rgba(255,255,255,0.01)] backdrop-blur-[1px]`}
            />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[76%] w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-white/[0.008]" />
          </>
        )}
        {highlighted && (
          <div className="absolute inset-[-8%] rounded-xl border-2 border-amber-300/95 bg-amber-300/10" />
        )}
        {!enabled && (
          <div className="absolute inset-0 rounded-xl bg-black/25 backdrop-blur-[1px]" />
        )}
      </div>
      <div
        className="pointer-events-none absolute z-[25]"
        style={{
          left: `${layout.cx * 100}%`,
          top: `calc(${layout.cy * 100}% + ${knobY}%)`,
          width: "4.4%",
          height: "16%",
          transform: `translate(-50%, -50%) rotateX(${value * 12}deg)`,
          transformOrigin: "50% 90%",
          transition: active ? "none" : "top 120ms ease, transform 120ms ease",
        }}
      >
        <div className="absolute bottom-0 left-1/2 h-[72%] w-[32%] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#15191f] to-[#050608] shadow-[0_7px_9px_rgba(0,0,0,0.45)]" />
        <div className="absolute left-1/2 top-0 h-[42%] w-full -translate-x-1/2 rounded-[28%] border-2 border-black/70 bg-gradient-to-br from-[#565f6d] to-[#171b22] shadow-[inset_4px_5px_5px_rgba(255,255,255,0.15),0_5px_8px_rgba(0,0,0,0.45)]" />
      </div>
    </>
  );
}

interface DualTravelCenterProps {
  layout: JoystickLayout;
  enabled: boolean;
  highlighted: boolean;
  showTouchZone: boolean;
  onChange: (value: number) => void;
}

function DualTravelCenter({
  layout,
  enabled,
  highlighted,
  showTouchZone,
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
        top: `calc(${layout.cy * 100}% - 8%)`,
        width: "10.2%",
        height: "31%",
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
          <div className="pointer-events-none absolute inset-0 rounded-xl border border-emerald-200/32 bg-emerald-400/[0.01] shadow-[inset_0_0_14px_rgba(255,255,255,0.01)] backdrop-blur-[1px]" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[74%] w-[20%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-white/[0.008]" />
        </>
      )}
      {highlighted && (
        <div className="absolute inset-[-8%] rounded-xl border-2 border-amber-300/80 bg-amber-300/10" />
      )}
    </div>
  );
}

interface ToggleButtonProps {
  label: string;
  active: boolean;
  cx: number;
  cy: number;
  color: "blue" | "amber" | "red";
  onToggle: () => void;
}

function ToggleButton({ label, active, cx, cy, color, onToggle }: ToggleButtonProps) {
  const activeColors = {
    blue: "from-sky-200 to-blue-600 shadow-sky-400/70",
    amber: "from-amber-200 to-orange-600 shadow-orange-400/70",
    red: "from-red-300 to-red-700 shadow-red-400/70",
  }[color];

  return (
    <button
      type="button"
      className={`absolute z-40 rounded-md border border-black/70 bg-gradient-to-br text-[0px] shadow-lg active:scale-95 ${
        active ? activeColors : "from-[#353b43] to-[#11151b]"
      }`}
      style={{
        left: `${cx * 100}%`,
        top: `${cy * 100}%`,
        width: "4.4%",
        height: "4.6%",
        transform: "translate(-50%, -50%)",
      }}
      onClick={onToggle}
      aria-pressed={active}
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
    </button>
  );
}

function SpeedModeLever({
  active,
  cx,
  cy,
  showTouchZone,
  onToggle,
}: {
  active: boolean;
  cx: number;
  cy: number;
  showTouchZone: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="absolute z-40 touch-none rounded-full active:scale-95"
      style={{
        left: `${cx * 100}%`,
        top: `${cy * 100}%`,
        width: "7.2%",
        height: "26%",
        transform: "translate(-50%, -50%)",
      }}
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? "유압 속도 x2" : "유압 속도 x1"}
    >
      {showTouchZone && (
        <span className="pointer-events-none absolute inset-[-8%] rounded-full border border-sky-200/32 bg-sky-400/[0.01] shadow-[inset_0_0_12px_rgba(255,255,255,0.01)]" />
      )}
      <span className="pointer-events-none absolute inset-x-[10%] top-[2%] h-[96%] rounded-full bg-gradient-to-b from-black via-black/95 to-[#11151b]/90 shadow-[0_0_14px_rgba(0,0,0,0.8)]" />
      <span
        className={`pointer-events-none absolute left-1/2 -top-[10%] z-20 -translate-x-1/2 rounded-full border px-1.5 py-0.5 text-[9px] font-black shadow-lg ${
          active
            ? "border-sky-200/70 bg-sky-500 text-white"
            : "border-white/25 bg-black/70 text-white/85"
        }`}
      >
        {active ? "x2" : "x1"}
      </span>
      <span className="pointer-events-none absolute bottom-[8%] left-1/2 z-10 h-[64%] w-[16%] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#232a32] to-[#07090d] shadow-[0_5px_9px_rgba(0,0,0,0.55)]" />
      <span
        className={`pointer-events-none absolute left-1/2 z-10 h-[25%] w-[54%] -translate-x-1/2 rounded-full border border-black/70 bg-gradient-to-br from-[#68727e] via-[#252b33] to-[#080a0f] shadow-lg transition-[top,transform] duration-150 ${
          active ? "top-[18%]" : "top-[34%]"
        }`}
      />
    </button>
  );
}

function PedalSwingControl({
  activeValue,
  showTouchZone,
  onChange,
}: {
  activeValue: number;
  showTouchZone: boolean;
  onChange: (value: number) => void;
}) {
  const pedal = COCKPIT_LAYOUT.rightPedal;
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
        left: `${pedal.cx * 100}%`,
        top: `${pedal.cy * 100}%`,
        width: `${pedal.width * 100}%`,
        height: `${pedal.height * 100}%`,
        transform: "translate(-50%, -50%)",
        WebkitTouchCallout: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="우측 페달 붐 스윙"
    >
      {showTouchZone && (
        <div className="pointer-events-none absolute inset-0 rounded-lg border border-amber-200/32 bg-amber-400/[0.01] shadow-[inset_0_0_12px_rgba(255,255,255,0.01)]" />
      )}
      <button
        type="button"
        className={`absolute inset-x-0 top-0 h-1/2 rounded-t-lg border border-white/10 transition-[box-shadow,background-color] duration-300 ease-out ${
          activeValue > 0.02
            ? "bg-black/25 shadow-[inset_0_7px_12px_rgba(0,0,0,0.58)]"
            : "bg-black/5"
        }`}
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
        className={`absolute inset-x-0 bottom-0 h-1/2 rounded-b-lg border border-white/10 transition-[box-shadow,background-color] duration-300 ease-out ${
          activeValue < -0.02
            ? "bg-black/25 shadow-[inset_0_-7px_12px_rgba(0,0,0,0.58)]"
            : "bg-black/5"
        }`}
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
}: CockpitOverlayProps) {
  const aspect = (COCKPIT_LAYOUT.height / COCKPIT_LAYOUT.width) * 100;
  const highlightLeft =
    tutorialStep?.highlight === "left" || tutorialStep?.highlight === "both";
  const highlightRight =
    tutorialStep?.highlight === "right" || tutorialStep?.highlight === "both";
  const highlightTravel = tutorialStep?.highlight === "travel";

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={YANMAR_ASSETS.cockpit}
          alt="얀마 게임형 굴착기 조작 패널"
          className="mx-auto block w-full max-w-lg select-none drop-shadow-[0_-10px_24px_rgba(0,0,0,0.45)]"
          draggable={false}
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 mx-auto w-full max-w-lg touch-none">
        <div className="relative w-full" style={{ paddingBottom: `${aspect}%` }}>
          <TravelLever
            side="left"
            layout={COCKPIT_LAYOUT.travelLeft}
            value={input.travel.left}
            enabled={allowed.travel && !auxiliary.safetyLocked}
            highlighted={highlightTravel}
            showTouchZone={showTouchZones}
            onChange={(left) =>
              onInputChange((current) => ({
                ...current,
                travel: { ...current.travel, left },
              }))
            }
          />
          <TravelLever
            side="right"
            layout={COCKPIT_LAYOUT.travelRight}
            value={input.travel.right}
            enabled={allowed.travel && !auxiliary.safetyLocked}
            highlighted={highlightTravel}
            showTouchZone={showTouchZones}
            onChange={(right) =>
              onInputChange((current) => ({
                ...current,
                travel: { ...current.travel, right },
              }))
            }
          />
          <DualTravelCenter
            layout={COCKPIT_LAYOUT.travelBoth}
            enabled={allowed.travel && !auxiliary.safetyLocked}
            highlighted={highlightTravel}
            showTouchZone={showTouchZones}
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
            onChange={(boomSwing) => onAuxiliaryChange((current) => ({ ...current, boomSwing }))}
          />
          <SpeedModeLever
            cx={COCKPIT_LAYOUT.hydraulicSpeed.cx}
            cy={COCKPIT_LAYOUT.hydraulicSpeed.cy}
            active={auxiliary.highSpeed}
            showTouchZone={showTouchZones}
            onToggle={() =>
              onAuxiliaryChange((current) => ({ ...current, highSpeed: !current.highSpeed }))
            }
          />
          <ToggleButton
            label="잠"
            color="red"
            cx={0.345}
            cy={0.18}
            active={auxiliary.safetyLocked}
            onToggle={() =>
              onAuxiliaryChange({
                ...auxiliary,
                safetyLocked: !auxiliary.safetyLocked,
              })
            }
          />
          <GameJoystick
            side="left"
            layout={COCKPIT_LAYOUT.left}
            value={input.left}
            enabled={{
              x: allowed.leftX && !auxiliary.safetyLocked,
              y: allowed.leftY && !auxiliary.safetyLocked,
            }}
            highlighted={highlightLeft}
            showTouchZone={showTouchZones}
            onChange={(x, y) =>
              onInputChange((current) => ({ ...current, left: { x, y } }))
            }
          />
          <GameJoystick
            side="right"
            layout={COCKPIT_LAYOUT.right}
            value={input.right}
            enabled={{
              x: allowed.rightX && !auxiliary.safetyLocked,
              y: allowed.rightY && !auxiliary.safetyLocked,
            }}
            highlighted={highlightRight}
            showTouchZone={showTouchZones}
            onChange={(x, y) =>
              onInputChange((current) => ({ ...current, right: { x, y } }))
            }
            hornLayout={COCKPIT_LAYOUT.horn}
          />
          <div className="pointer-events-none absolute bottom-[5%] left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded-full bg-black/60 px-2 py-1 text-[8px] font-bold text-white shadow-lg backdrop-blur-sm">
            <span className={auxiliary.safetyLocked ? "text-red-300" : "text-emerald-300"}>
              {auxiliary.safetyLocked ? "안전레버 잠김" : "조작 가능"}
            </span>
            <span className="text-white/35">|</span>
            <span className={auxiliary.highSpeed ? "text-sky-300" : "text-white/45"}>
              유압 {auxiliary.highSpeed ? "x2" : "x1"}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
