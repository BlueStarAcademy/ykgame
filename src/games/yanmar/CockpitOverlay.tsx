"use client";

import { useCallback, useRef, useState } from "react";
import type { ControlMask, ExcavatorControlState } from "./controls";
import { COCKPIT_LAYOUT, YANMAR_ASSETS } from "./controls";
import type { TutorialStep } from "./tutorial";

interface CockpitOverlayProps {
  input: ExcavatorControlState;
  onInputChange: (input: ExcavatorControlState) => void;
  allowed: ControlMask;
  tutorialStep: TutorialStep | null;
  onSkipTutorial?: () => void;
}

interface JoystickLayout {
  cx: number;
  cy: number;
  radius: number;
}

interface ImageJoystickProps {
  side: "left" | "right";
  layout: JoystickLayout;
  knobTravel: number;
  value: { x: number; y: number };
  enabled: { x: boolean; y: boolean };
  highlighted: boolean;
  onChange: (x: number, y: number) => void;
}

function ImageJoystick({
  side,
  layout,
  knobTravel,
  value,
  enabled,
  highlighted,
  onChange,
}: ImageJoystickProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);

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
      const nx = enabled.x ? dx / maxR : 0;
      const ny = enabled.y ? -dy / maxR : 0;
      onChange(nx, ny);
    },
    [enabled.x, enabled.y, onChange],
  );

  const releaseCapture = useCallback(() => {
    const el = zoneRef.current;
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
    setActive(false);
  }, []);

  const handleStart = (e: React.PointerEvent) => {
    if (!enabled.x && !enabled.y) return;
    e.preventDefault();
    dragging.current = true;
    setActive(true);
    pointerIdRef.current = e.pointerId;
    zoneRef.current?.setPointerCapture(e.pointerId);
    updateFromEvent(e.clientX, e.clientY);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!dragging.current || pointerIdRef.current !== e.pointerId) return;
    updateFromEvent(e.clientX, e.clientY);
  };

  const handleEnd = (e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;
    releaseCapture();
    onChange(0, 0);
  };

  const size = `${layout.radius * 200}%`;
  const knobSize = `${knobTravel * 200}%`;
  const knobX = `calc(-50% + ${value.x * 42}%)`;
  const knobY = `calc(-50% + ${-value.y * 42}%)`;
  const isDisabled = !enabled.x && !enabled.y;

  return (
    <div
      ref={zoneRef}
      className={`absolute touch-none ${isDisabled ? "pointer-events-none" : ""}`}
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
        dragging.current = false;
        pointerIdRef.current = null;
        setActive(false);
        onChange(0, 0);
      }}
      aria-label={side === "left" ? "좌 조이스틱" : "우 조이스틱"}
    >
      {highlighted && (
        <div className="yanmar-joystick-highlight absolute inset-[-12%] rounded-full border-2 border-amber-400/90" />
      )}
      {isDisabled && (
        <div className="absolute inset-0 rounded-full bg-black/25 backdrop-blur-[1px]" />
      )}
      <div
        className="pointer-events-none absolute rounded-full border border-red-900/50 bg-gradient-to-br from-red-300/90 to-red-800/90 shadow-[0_3px_10px_rgba(0,0,0,0.5)]"
        style={{
          width: knobSize,
          height: knobSize,
          left: knobX,
          top: knobY,
          opacity: active || value.x !== 0 || value.y !== 0 ? 0.95 : 0,
          transition: active ? "none" : "opacity 0.12s ease",
        }}
      />
    </div>
  );
}

interface TravelLeverProps {
  layout: JoystickLayout;
  knobTravel: number;
  value: number;
  enabled: boolean;
  highlighted: boolean;
  onChange: (value: number) => void;
}

function TravelLever({
  layout,
  knobTravel,
  value,
  enabled,
  highlighted,
  onChange,
}: TravelLeverProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);

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

  const releaseCapture = useCallback(() => {
    const el = zoneRef.current;
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
    setActive(false);
  }, []);

  const handleStart = (e: React.PointerEvent) => {
    if (!enabled) return;
    e.preventDefault();
    dragging.current = true;
    setActive(true);
    pointerIdRef.current = e.pointerId;
    zoneRef.current?.setPointerCapture(e.pointerId);
    updateFromEvent(e.clientY);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!dragging.current || pointerIdRef.current !== e.pointerId) return;
    updateFromEvent(e.clientY);
  };

  const handleEnd = (e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;
    releaseCapture();
    onChange(0);
  };

  const w = `${layout.radius * 120}%`;
  const h = `${layout.radius * 280}%`;
  const knobSize = `${knobTravel * 180}%`;
  const knobY = `calc(-50% + ${-value * 38}%)`;

  return (
    <div
      ref={zoneRef}
      className={`absolute touch-none ${!enabled ? "pointer-events-none" : ""}`}
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
        dragging.current = false;
        pointerIdRef.current = null;
        setActive(false);
        onChange(0);
      }}
      aria-label="주행 레버"
    >
      {highlighted && (
        <div className="absolute inset-[-8%] rounded-lg border-2 border-amber-400/90" />
      )}
      {!enabled && (
        <div className="absolute inset-0 rounded-lg bg-black/25 backdrop-blur-[1px]" />
      )}
      <div
        className="pointer-events-none absolute left-1/2 rounded-sm border border-gray-700/60 bg-gradient-to-b from-gray-200/90 to-gray-500/90 shadow-md"
        style={{
          width: knobSize,
          height: knobSize,
          top: knobY,
          transform: "translateX(-50%)",
          opacity: active || value !== 0 ? 0.95 : 0,
          transition: active ? "none" : "opacity 0.12s ease",
        }}
      />
    </div>
  );
}

export function CockpitOverlay({
  input,
  onInputChange,
  allowed,
  tutorialStep,
  onSkipTutorial,
}: CockpitOverlayProps) {
  const aspect = (COCKPIT_LAYOUT.height / COCKPIT_LAYOUT.width) * 100;
  const highlightLeft =
    tutorialStep?.highlight === "left" || tutorialStep?.highlight === "both";
  const highlightRight =
    tutorialStep?.highlight === "right" || tutorialStep?.highlight === "both";
  const highlightTravel = tutorialStep?.highlight === "travel";

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={YANMAR_ASSETS.cockpit}
          alt="얀마 굴착기 운전대"
          className="mx-auto block w-full max-w-lg select-none"
          draggable={false}
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 mx-auto w-full max-w-lg">
        {tutorialStep && (
          <div className="absolute inset-x-0 z-30 -top-8 px-2">
            <div className="flex items-center gap-2 rounded-lg bg-black/75 px-2.5 py-1.5 text-white backdrop-blur-sm">
              <span className="shrink-0 text-[10px] font-bold text-amber-300">
                {tutorialStep.title}
              </span>
              <span className="min-w-0 flex-1 truncate text-[10px] leading-tight">
                {tutorialStep.instruction}
              </span>
              {onSkipTutorial && (
                <button
                  type="button"
                  onClick={onSkipTutorial}
                  className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-medium hover:bg-white/20"
                >
                  건너뛰기
                </button>
              )}
            </div>
          </div>
        )}

        <div className="relative w-full" style={{ paddingBottom: `${aspect}%` }}>
          <TravelLever
            layout={COCKPIT_LAYOUT.travel}
            knobTravel={COCKPIT_LAYOUT.knobTravel}
            value={input.travel}
            enabled={allowed.travel}
            highlighted={highlightTravel}
            onChange={(travel) => onInputChange({ ...input, travel })}
          />
          <ImageJoystick
            side="left"
            layout={COCKPIT_LAYOUT.left}
            knobTravel={COCKPIT_LAYOUT.knobTravel}
            value={input.left}
            enabled={{ x: allowed.leftX, y: allowed.leftY }}
            highlighted={highlightLeft}
            onChange={(x, y) => onInputChange({ ...input, left: { x, y } })}
          />
          <ImageJoystick
            side="right"
            layout={COCKPIT_LAYOUT.right}
            knobTravel={COCKPIT_LAYOUT.knobTravel}
            value={input.right}
            enabled={{ x: allowed.rightX, y: allowed.rightY }}
            highlighted={highlightRight}
            onChange={(x, y) => onInputChange({ ...input, right: { x, y } })}
          />
        </div>
      </div>
    </>
  );
}
