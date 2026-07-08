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
          width: "10.4%",
          height: "31.5%",
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

  const hitboxCenterOffset = side === "left" ? "-4.8%" : "4.8%";
  const hitboxWidth = "9.8%";
  const hitboxTopOffset = "-4%";
  const hitboxHeight = "32%";
  const knobY = -value * layout.travel * 118;

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
          width: "3.8%",
          height: "11.5%",
          transform: `translate(-50%, -50%) rotateX(${value * 10}deg)`,
          transformOrigin: "50% 88%",
          transition: active ? "none" : "top 120ms ease, transform 120ms ease",
        }}
      >
        <div className="absolute bottom-0 left-1/2 h-[68%] w-[28%] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#15191f] to-[#050608] shadow-[0_5px_8px_rgba(0,0,0,0.45)]" />
        <div className="absolute left-1/2 top-0 h-[48%] w-full -translate-x-1/2 rounded-[18%] border-2 border-black/70 bg-gradient-to-br from-[#565f6d] to-[#171b22] shadow-[inset_3px_4px_4px_rgba(255,255,255,0.15),0_4px_7px_rgba(0,0,0,0.45)]" />
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
        top: `calc(${layout.cy * 100}% - 4%)`,
        width: "9.8%",
        height: "32%",
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
        width: "8.2%",
        height: "24%",
        transform: "translate(-50%, -50%)",
      }}
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? "유압 속도 x2" : "유압 속도 x1"}
    >
      {showTouchZone && (
        <span className="pointer-events-none absolute inset-[-8%] rounded-full border border-sky-200/32 bg-sky-400/[0.01] shadow-[inset_0_0_12px_rgba(255,255,255,0.01)]" />
      )}
      <span className="pointer-events-none absolute bottom-[4%] left-[22%] h-[82%] w-[13%] -translate-x-1/2 rounded-full border border-white/10 bg-gradient-to-b from-[#2b323b] via-[#0c0f14] to-black shadow-[0_8px_13px_rgba(0,0,0,0.72)]" />
      <span
        className={`pointer-events-none absolute right-[2%] top-[10%] z-20 rounded-full border px-1.5 py-0.5 text-[8px] font-black shadow-lg ${
          active
            ? "border-sky-200/70 bg-sky-500 text-white"
            : "border-white/25 bg-black/70 text-white/85"
        }`}
      >
        {active ? "x2" : "x1"}
      </span>
      <span
        className={`pointer-events-none absolute left-[22%] z-10 h-[22%] w-[42%] -translate-x-1/2 rounded-full border border-black/70 bg-gradient-to-br from-[#737e8b] via-[#252b33] to-[#080a0f] shadow-[inset_4px_5px_6px_rgba(255,255,255,0.18),0_6px_12px_rgba(0,0,0,0.58)] transition-[top,transform] duration-150 ${
          active ? "top-[16%] -rotate-3" : "top-[42%] rotate-3"
        }`}
      />
    </button>
  );
}

function SafetyLever({
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
      className="absolute z-50 touch-none active:scale-[0.98]"
      style={{
        left: `${cx * 100}%`,
        top: `${cy * 100}%`,
        width: "5.4%",
        height: "29%",
        transform: "translate(-50%, -50%)",
        perspective: "140px",
      }}
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? "안전레버 잠김" : "안전레버 해제"}
    >
      {showTouchZone && (
        <span className="pointer-events-none absolute inset-[-6%] rounded-xl border border-red-200/35 bg-red-400/[0.01] shadow-[inset_0_0_14px_rgba(255,255,255,0.01)]" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={YANMAR_ASSETS.safetyLever}
        alt=""
        className="pointer-events-none h-full w-full object-contain object-bottom drop-shadow-[0_4px_8px_rgba(0,0,0,0.55)] transition-transform duration-200 ease-out"
        style={{
          transform: active
            ? "translateY(22%) rotateX(32deg)"
            : "translateY(-8%) rotateX(-12deg)",
          transformOrigin: "50% 92%",
        }}
        draggable={false}
        aria-hidden
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
      <div className="pointer-events-none absolute inset-0 rounded-xl border border-black/70 bg-gradient-to-b from-[#303742] via-[#151a21] to-[#050607] shadow-[inset_4px_5px_8px_rgba(255,255,255,0.12),0_8px_13px_rgba(0,0,0,0.58)]" />
      <div className="pointer-events-none absolute left-[16%] right-[16%] top-[12%] h-[3px] rounded-full bg-white/18" />
      <div className="pointer-events-none absolute left-[16%] right-[16%] bottom-[12%] h-[3px] rounded-full bg-black/45" />
      <button
        type="button"
        className={`absolute inset-x-[8%] top-[7%] h-[43%] rounded-t-lg border border-white/10 transition-[box-shadow,background-color,transform] duration-300 ease-out ${
          activeValue > 0.02
            ? "bg-black/25 shadow-[inset_0_8px_14px_rgba(0,0,0,0.62)]"
            : "bg-white/[0.03] shadow-[inset_0_2px_5px_rgba(255,255,255,0.08)]"
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
        className={`absolute inset-x-[8%] bottom-[7%] h-[43%] rounded-b-lg border border-white/10 transition-[box-shadow,background-color,transform] duration-300 ease-out ${
          activeValue < -0.02
            ? "bg-black/25 shadow-[inset_0_-8px_14px_rgba(0,0,0,0.62)]"
            : "bg-white/[0.03] shadow-[inset_0_-2px_5px_rgba(255,255,255,0.05)]"
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
          <SafetyLever
            cx={COCKPIT_LAYOUT.safetyLever.cx}
            cy={COCKPIT_LAYOUT.safetyLever.cy}
            active={auxiliary.safetyLocked}
            showTouchZone={showTouchZones}
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
