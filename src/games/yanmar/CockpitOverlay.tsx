"use client";

/* eslint-disable react-hooks/immutability */

import { useCallback, useRef, useState } from "react";
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
  onAuxiliaryChange: (input: AuxiliaryControlState) => void;
  allowed: ControlMask;
  tutorialStep: TutorialStep | null;
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

function clamp(v: number, min = -1, max = 1) {
  return Math.max(min, Math.min(max, v));
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
  value: AxisValue;
  enabled: { x: boolean; y: boolean };
  highlighted: boolean;
  onChange: (x: number, y: number) => void;
  hornLayout?: HornLayout;
}

function GameJoystick({
  side,
  layout,
  value,
  enabled,
  highlighted,
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
      const maxR = rect.width / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }
      const rawX = enabled.x ? dx / maxR : 0;
      const rawY = enabled.y ? -dy / maxR : 0;
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

  const size = `${layout.radius * 200}%`;
  const visualX = value.x * layout.travel * 48;
  const visualY = -value.y * layout.travel * 42;
  const leanX = value.x * 16;
  const leanY = value.y * 11;
  const isDisabled = !enabled.x && !enabled.y;

  return (
    <>
      <div
        ref={zoneRef}
        className={`absolute z-30 touch-none rounded-full ${isDisabled ? "pointer-events-none" : ""}`}
        style={{
          left: `${layout.cx * 100}%`,
          top: `${layout.cy * 100}%`,
          width: size,
          height: size,
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
        {highlighted && (
          <div className="yanmar-joystick-highlight absolute inset-[-10%] rounded-full border-2 border-amber-300/95 bg-amber-300/10" />
        )}
        {isDisabled && (
          <div className="absolute inset-0 rounded-full bg-black/25 backdrop-blur-[1px]" />
        )}
      </div>

      <div
        className="pointer-events-none absolute z-[24]"
        style={{
          left: `${layout.cx * 100}%`,
          top: `${layout.cy * 100}%`,
          width: "8.2%",
          height: "25%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <div className="absolute inset-x-[6%] bottom-[2%] h-[78%] rounded-[42%_42%_34%_34%] bg-gradient-to-br from-[#6f7781] via-[#343b44] to-[#14191f] shadow-[inset_7px_8px_10px_rgba(255,255,255,0.13),inset_-8px_-10px_12px_rgba(0,0,0,0.46),0_10px_18px_rgba(0,0,0,0.45)]" />
        <div className="absolute left-1/2 top-[16%] h-[62%] w-[46%] -translate-x-1/2 rounded-[38%] bg-gradient-to-b from-[#0d1015] via-[#161b22] to-[#050608] shadow-[inset_0_4px_7px_rgba(255,255,255,0.06)]" />
        <div className="absolute left-1/2 top-[48%] h-[18%] w-[76%] -translate-x-1/2 rounded-full bg-black/35 blur-[2px]" />
      </div>

      <div
        className="pointer-events-none absolute z-[25]"
        style={{
          left: `${layout.cx * 100}%`,
          top: `calc(${layout.cy * 100}% + ${visualY}%)`,
          width: "7.4%",
          height: "25.5%",
          transform: `translate(calc(-50% + ${visualX}%), -50%) rotateX(${leanY}deg) rotateZ(${leanX}deg)`,
          transformOrigin: "50% 100%",
          transition: active ? "none" : "left 120ms ease, top 120ms ease, transform 120ms ease",
        }}
      >
        <div
          className="absolute left-1/2 top-0 h-[91%] w-[68%] -translate-x-1/2 border-2 border-black/75 bg-gradient-to-br from-[#6b747f] via-[#252b34] to-[#080a0f] shadow-[inset_7px_9px_10px_rgba(255,255,255,0.15),inset_-7px_-10px_10px_rgba(0,0,0,0.52),0_11px_15px_rgba(0,0,0,0.48)]"
          style={{
            borderRadius: "42% 28% 34% 34% / 16% 18% 36% 36%",
            clipPath: "polygon(13% 0%, 83% 0%, 94% 15%, 72% 100%, 29% 100%, 6% 18%)",
          }}
        >
          <div className="absolute left-[13%] top-[3%] h-[16%] w-[68%] rounded-[32%] bg-gradient-to-b from-white/18 to-white/4" />
          <div className="absolute left-[18%] top-[12%] h-[35%] w-[38%] rounded-full bg-white/13 blur-[1px]" />
          <div className="absolute right-[14%] top-[8%] h-[24%] w-[16%] rounded-full bg-white/8" />
          {hornLayout && (
            <span
              className="absolute left-1/2 top-[6%] aspect-square w-[28%] -translate-x-1/2 rounded-full border-2 border-black/70 bg-gradient-to-br from-white via-[#d7d4cc] to-[#8b8781] shadow-[0_3px_7px_rgba(0,0,0,0.55),inset_0_2px_2px_rgba(255,255,255,0.75)]"
              aria-hidden
            />
          )}
        </div>
      </div>
    </>
  );
}

interface TravelLeverProps {
  layout: JoystickLayout;
  value: number;
  enabled: boolean;
  highlighted: boolean;
  onChange: (value: number) => void;
}

function TravelLever({
  layout,
  value,
  enabled,
  highlighted,
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
      onChange(-dy / maxR);
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

  const w = `${layout.radius * 190}%`;
  const h = `${layout.radius * 380}%`;
  const knobY = -value * layout.travel * 100;

  return (
    <>
      <div
        ref={zoneRef}
        className={`absolute z-30 touch-none rounded-xl ${!enabled ? "pointer-events-none" : ""}`}
        style={{
          left: `${layout.cx * 100}%`,
          top: `${layout.cy * 100}%`,
          width: w,
          height: h,
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

interface AuxLeverProps {
  label: string;
  layout: JoystickLayout;
  value: number;
  onChange: (value: number) => void;
}

function AuxLever({ label, layout, value, onChange }: AuxLeverProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const pointer = usePointerRelease(() => onChange(0));
  const [active, setActive] = useState(false);

  const updateFromEvent = useCallback(
    (clientY: number) => {
      const zone = zoneRef.current;
      if (!zone) return;
      const rect = zone.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      onChange(clamp(-(clientY - center) / (rect.height / 2)));
    },
    [onChange],
  );

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    pointer.dragging.current = true;
    pointer.pointerIdRef.current = e.pointerId;
    setActive(true);
    zoneRef.current?.setPointerCapture(e.pointerId);
    updateFromEvent(e.clientY);
  };

  const move = (e: React.PointerEvent) => {
    if (!pointer.dragging.current || pointer.pointerIdRef.current !== e.pointerId) return;
    updateFromEvent(e.clientY);
  };

  const end = (e: React.PointerEvent) => {
    if (pointer.pointerIdRef.current !== e.pointerId) return;
    pointer.releaseCapture(zoneRef.current);
    setActive(false);
    pointer.onRelease();
  };

  return (
    <>
      <div
        ref={zoneRef}
        className="absolute z-30 touch-none rounded-full"
        style={{
          left: `${layout.cx * 100}%`,
          top: `${layout.cy * 100}%`,
          width: `${layout.radius * 160}%`,
          height: `${layout.radius * 260}%`,
          transform: "translate(-50%, -50%)",
        }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={() => {
          pointer.dragging.current = false;
          pointer.pointerIdRef.current = null;
          setActive(false);
          onChange(0);
        }}
        aria-label={label}
      />
      <div
        className="pointer-events-none absolute z-[25]"
        style={{
          left: `${layout.cx * 100}%`,
          top: `calc(${layout.cy * 100}% + ${-value * layout.travel * 100}%)`,
          width: "3.2%",
          height: "15%",
          transform: `translate(-50%, -50%) rotateX(${value * 10}deg)`,
          transition: active ? "none" : "top 120ms ease, transform 120ms ease",
        }}
      >
        <div className="absolute bottom-0 left-1/2 h-[76%] w-[30%] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#12161c] to-[#050608]" />
        <div className="absolute left-1/2 top-0 h-[43%] w-full -translate-x-1/2 rounded-full border border-black/70 bg-gradient-to-br from-[#5b6571] to-[#11151b] shadow-md" />
      </div>
    </>
  );
}

interface ToggleButtonProps {
  label: string;
  active: boolean;
  cx: number;
  cy: number;
  color: "green" | "blue" | "amber" | "red";
  onToggle: () => void;
}

function ToggleButton({ label, active, cx, cy, color, onToggle }: ToggleButtonProps) {
  const activeColors = {
    green: "from-lime-300 to-emerald-600 shadow-emerald-400/70",
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
  onToggle,
}: {
  active: boolean;
  cx: number;
  cy: number;
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

function PedalSwingToggle({
  activeValue,
  onChange,
}: {
  activeValue: number;
  onChange: (value: number) => void;
}) {
  const pedal = COCKPIT_LAYOUT.rightPedal;

  const toggle = (value: number) => {
    onChange(activeValue === value ? 0 : value);
  };

  return (
    <div
      className="absolute z-40"
      style={{
        left: `${pedal.cx * 100}%`,
        top: `${pedal.cy * 100}%`,
        width: `${pedal.width * 100}%`,
        height: `${pedal.height * 100}%`,
        transform: "translate(-50%, -50%)",
      }}
      aria-label="우측 페달 붐 스윙"
    >
      <button
        type="button"
        className={`absolute inset-x-0 top-0 h-1/2 rounded-t-lg border border-white/10 ${
          activeValue > 0
            ? "bg-sky-400/30 shadow-[0_0_10px_rgba(56,189,248,0.55)]"
            : "bg-black/5"
        }`}
        onClick={() => toggle(1)}
        aria-pressed={activeValue > 0}
        aria-label="우측 페달 위쪽: 암 우측 회전"
      >
        <span className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 rounded bg-black/60 px-1 text-[8px] font-bold text-white">
          우
        </span>
      </button>
      <button
        type="button"
        className={`absolute inset-x-0 bottom-0 h-1/2 rounded-b-lg border border-white/10 ${
          activeValue < 0
            ? "bg-amber-400/30 shadow-[0_0_10px_rgba(251,191,36,0.55)]"
            : "bg-black/5"
        }`}
        onClick={() => toggle(-1)}
        aria-pressed={activeValue < 0}
        aria-label="우측 페달 아래쪽: 암 좌측 회전"
      >
        <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/60 px-1 text-[8px] font-bold text-white">
          좌
        </span>
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

      <div className="absolute inset-x-0 bottom-0 z-20 mx-auto w-full max-w-lg">
        <div className="relative w-full" style={{ paddingBottom: `${aspect}%` }}>
          <TravelLever
            layout={COCKPIT_LAYOUT.travelLeft}
            value={input.travel.left}
            enabled={allowed.travel && !auxiliary.safetyLocked}
            highlighted={highlightTravel}
            onChange={(left) =>
              onInputChange((current) => ({
                ...current,
                travel: { ...current.travel, left },
              }))
            }
          />
          <TravelLever
            layout={COCKPIT_LAYOUT.travelRight}
            value={input.travel.right}
            enabled={allowed.travel && !auxiliary.safetyLocked}
            highlighted={highlightTravel}
            onChange={(right) =>
              onInputChange((current) => ({
                ...current,
                travel: { ...current.travel, right },
              }))
            }
          />
          <AuxLever
            label="블레이드"
            layout={COCKPIT_LAYOUT.blade}
            value={auxiliary.blade}
            onChange={(blade) => onAuxiliaryChange({ ...auxiliary, blade })}
          />
          <PedalSwingToggle
            activeValue={auxiliary.boomSwing}
            onChange={(boomSwing) => onAuxiliaryChange({ ...auxiliary, boomSwing })}
          />
          <AuxLever
            label="엔진 회전수"
            layout={COCKPIT_LAYOUT.throttle}
            value={auxiliary.throttle}
            onChange={(throttle) => onAuxiliaryChange({ ...auxiliary, throttle })}
          />
          <div
            className="pointer-events-none absolute z-[24] rounded-full bg-gradient-to-b from-black via-black/95 to-[#11151b]/90 shadow-[0_0_18px_rgba(0,0,0,0.9)]"
            style={{
              left: `${COCKPIT_LAYOUT.hydraulicSpeed.cx * 100}%`,
              top: `calc(${COCKPIT_LAYOUT.hydraulicSpeed.cy * 100}% + 14%)`,
              width: "8%",
              height: "34%",
              transform: "translate(-50%, -50%)",
            }}
          />
          <SpeedModeLever
            cx={COCKPIT_LAYOUT.hydraulicSpeed.cx}
            cy={COCKPIT_LAYOUT.hydraulicSpeed.cy}
            active={auxiliary.highSpeed}
            onToggle={() => onAuxiliaryChange({ ...auxiliary, highSpeed: !auxiliary.highSpeed })}
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
            onChange={(x, y) => onInputChange({ ...input, left: { x, y } })}
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
            onChange={(x, y) => onInputChange({ ...input, right: { x, y } })}
            hornLayout={COCKPIT_LAYOUT.horn}
          />
          <ToggleButton
            label="등"
            color="green"
            cx={0.395}
            cy={0.18}
            active={auxiliary.workLight}
            onToggle={() => onAuxiliaryChange({ ...auxiliary, workLight: !auxiliary.workLight })}
          />
          <ToggleButton
            label="폭"
            color="amber"
            cx={0.43}
            cy={0.29}
            active={auxiliary.trackWidth > 0}
            onToggle={() =>
              onAuxiliaryChange({
                ...auxiliary,
                trackWidth: auxiliary.trackWidth > 0 ? -1 : 1,
              })
            }
          />
          <ToggleButton
            label="잠"
            color="red"
            cx={0.57}
            cy={0.29}
            active={auxiliary.safetyLocked}
            onToggle={() =>
              onAuxiliaryChange({
                ...auxiliary,
                safetyLocked: !auxiliary.safetyLocked,
              })
            }
          />
          <div className="pointer-events-none absolute bottom-[5%] left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded-full bg-black/60 px-2 py-1 text-[8px] font-bold text-white shadow-lg backdrop-blur-sm">
            <span className={auxiliary.safetyLocked ? "text-red-300" : "text-emerald-300"}>
              {auxiliary.safetyLocked ? "안전레버 잠김" : "조작 가능"}
            </span>
            <span className="text-white/35">|</span>
            <span className={auxiliary.highSpeed ? "text-sky-300" : "text-white/45"}>
              유압 {auxiliary.highSpeed ? "x2" : "x1"}
            </span>
            <span className="text-white/35">|</span>
            <span className={auxiliary.workLight ? "text-lime-300" : "text-white/45"}>
              작업등 {auxiliary.workLight ? "ON" : "OFF"}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
