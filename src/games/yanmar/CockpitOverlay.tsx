"use client";

/* eslint-disable react-hooks/immutability */

import { useCallback, useEffect, useRef } from "react";
import type {
  AuxiliaryControlState,
  ControlMask,
  ExcavatorControlState,
} from "./controls";
import { CockpitControlDeck } from "./CockpitControlDeck";
import { COCKPIT_LAYOUT } from "./controls";
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
  enabled: { x: boolean; y: boolean };
  highlighted: boolean;
  showTouchZone: boolean;
  onChange: (x: number, y: number) => void;
  hornLayout?: HornLayout;
}

function GameJoystick({
  side,
  layout,
  enabled,
  highlighted,
  showTouchZone,
  onChange,
  hornLayout,
}: GameJoystickProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
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
          onChange(0, 0);
        }}
        aria-label={side === "left" ? "좌 조이스틱" : "우 조이스틱"}
      >
        {showTouchZone && (
          <div
            className={`pointer-events-none absolute inset-0 rounded-2xl border ${
              side === "left"
                ? "border-red-200/40 bg-transparent"
                : "border-sky-200/40 bg-transparent"
            } shadow-[inset_0_0_18px_rgba(255,255,255,0.01)]`}
          />
        )}
        {highlighted && (
          <div className="yanmar-joystick-highlight absolute inset-[-10%] rounded-full border-2 border-amber-300/95 bg-amber-300/10" />
        )}
        {isDisabled && (
          <div className="absolute inset-0 rounded-2xl bg-black/20" />
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
  onChange: (value: number) => void;
}

function TravelLever({
  side,
  layout,
  enabled,
  highlighted,
  showTouchZone,
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

  const hitboxCenterOffset = side === "left" ? "-4.8%" : "4.8%";
  const hitboxWidth = "9.8%";
  const hitboxTopOffset = "-4%";
  const hitboxHeight = "32%";

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
                  ? "border-sky-200/40 bg-transparent"
                  : "border-violet-200/40 bg-transparent"
              } shadow-[inset_0_0_14px_rgba(255,255,255,0.01)]`}
            />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[76%] w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-white/[0.008]" />
          </>
        )}
        {highlighted && (
          <div className="absolute inset-[-8%] rounded-xl border-2 border-amber-300/95 bg-amber-300/10" />
        )}
        {!enabled && (
          <div className="absolute inset-0 rounded-xl bg-black/20" />
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
          <div className="pointer-events-none absolute inset-0 rounded-xl border border-emerald-200/32 bg-transparent shadow-[inset_0_0_14px_rgba(255,255,255,0.01)]" />
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
      className="absolute z-40 touch-none active:scale-[0.98]"
      style={{
        left: `${cx * 100}%`,
        top: `${cy * 100}%`,
        width: "4.2%",
        height: "10.2%",
        transform: "translate(-50%, -50%)",
      }}
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? "유압 속도 x2" : "유압 속도 x1"}
    >
      {showTouchZone && (
        <span className="pointer-events-none absolute inset-[-20%] rounded-full border border-sky-200/40 bg-transparent shadow-[inset_0_0_12px_rgba(255,255,255,0.01)]" />
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
        width: "6.2%",
        height: "18.8%",
        transform: "translate(-50%, -50%)",
      }}
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? "안전레버 잠김" : "안전레버 해제"}
    >
      {showTouchZone && (
        <span className="pointer-events-none absolute inset-[-10%] rounded-xl border border-red-200/40 bg-transparent shadow-[inset_0_0_14px_rgba(255,255,255,0.01)]" />
      )}
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
        <div className="pointer-events-none absolute inset-0 rounded-lg border border-amber-200/40 bg-transparent shadow-[inset_0_0_12px_rgba(255,255,255,0.01)]" />
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
}: CockpitOverlayProps) {
  const aspect = (COCKPIT_LAYOUT.height / COCKPIT_LAYOUT.width) * 100;
  const highlightLeft =
    tutorialStep?.highlight === "left" || tutorialStep?.highlight === "both";
  const highlightRight =
    tutorialStep?.highlight === "right" || tutorialStep?.highlight === "both";
  const highlightTravel = tutorialStep?.highlight === "travel";

  return (
    <>
      <CockpitControlDeck input={input} auxiliary={auxiliary} />

      <div className="absolute inset-x-0 bottom-0 z-20 mx-auto w-full max-w-lg touch-none">
        <div className="relative w-full" style={{ paddingBottom: `${aspect}%` }}>
          <TravelLever
            side="left"
            layout={COCKPIT_LAYOUT.travelLeft}
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
          <div className="pointer-events-none absolute bottom-[5%] left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded-full bg-black/60 px-2 py-1 text-[8px] font-bold text-white shadow-lg">
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
