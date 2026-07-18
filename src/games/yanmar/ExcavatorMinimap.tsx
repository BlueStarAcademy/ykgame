"use client";

import { useEffect, useRef } from "react";
import type { ExcavatorSimState } from "./ExcavatorScene";
import type { TerrainData } from "./terrain";
import { DUMP_ZONE, getActiveDigZones, getMapWorldBounds } from "./terrain";
import type { TutorialStep, TutorialWaypoint } from "./tutorial";
import { REPAIR_TENT } from "./gearCatalog";
import { SITE_LAYOUT } from "./siteLayout";
import type { MonumentPhase } from "./monument/types";
import type { WorldPickupsState } from "./worldPickups";

interface ExcavatorMinimapProps {
  simRef: React.RefObject<ExcavatorSimState>;
  terrainRef: React.RefObject<TerrainData>;
  tutorialStepRef: React.RefObject<TutorialStep | null>;
  tutorialWaypointRef?: React.RefObject<TutorialWaypoint | null>;
  worldPickupsRef?: React.RefObject<WorldPickupsState | null>;
  visible: boolean;
  /** 가로 HUD 스택 안에 넣을 때 absolute 포지션 제거 */
  embedded?: boolean;
  /** 세로 HUD 등 공간이 좁을 때 캔버스 한 변 길이(px) */
  displaySize?: number;
  monumentPhase?: MonumentPhase;
}

const DEFAULT_DISPLAY_SIZE = 120;
const BASE_PAD = 11;

function getMinimapLayout(displaySize: number) {
  const scale = displaySize / DEFAULT_DISPLAY_SIZE;
  return {
    displaySize,
    pad: Math.max(8, Math.round(BASE_PAD * scale)),
    shellRadius: Math.max(10, Math.round(14 * scale)),
    innerStrokeRadius: Math.max(7, Math.round(10 * scale)),
  };
}

function worldToMinimap(
  x: number,
  z: number,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  displaySize: number,
  pad: number,
) {
  const inner = displaySize - pad * 2;
  const nx = (x - bounds.minX) / (bounds.maxX - bounds.minX);
  const nz = (z - bounds.minZ) / (bounds.maxZ - bounds.minZ);
  return {
    px: pad + nx * inner,
    // Flip Z so world +Z (north) is toward the top of the minimap (12 o'clock).
    py: pad + (1 - nz) * inner,
  };
}

function setupHiDpiCanvas(canvas: HTMLCanvasElement, displaySize: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(displaySize * dpr);
  canvas.height = Math.round(displaySize * dpr);
  canvas.style.width = `${displaySize}px`;
  canvas.style.height = `${displaySize}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  return ctx;
}

function drawMinimapStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
) {
  const inner = outer * 0.42;
  const spikes = 5;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    // Tip points up (-Y) so the star reads as standing.
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawMinimapBooster(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
) {
  const halfW = 1.6 * scale;
  const bodyH = 3.4 * scale;
  const tipH = 2.2 * scale;
  const flameH = 2.0 * scale;

  // Body (standing cylinder)
  ctx.beginPath();
  ctx.moveTo(cx - halfW, cy - bodyH * 0.15);
  ctx.lineTo(cx - halfW, cy + bodyH * 0.45);
  ctx.lineTo(cx + halfW, cy + bodyH * 0.45);
  ctx.lineTo(cx + halfW, cy - bodyH * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Nose cone (up)
  ctx.beginPath();
  ctx.moveTo(cx, cy - bodyH * 0.15 - tipH);
  ctx.lineTo(cx + halfW * 0.95, cy - bodyH * 0.15);
  ctx.lineTo(cx - halfW * 0.95, cy - bodyH * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Flame (down) — orange accent
  const prevFill = ctx.fillStyle;
  const prevStroke = ctx.strokeStyle;
  ctx.fillStyle = "#ff7a3d";
  ctx.strokeStyle = "#ffd0b8";
  ctx.beginPath();
  ctx.moveTo(cx - halfW * 1.15, cy + bodyH * 0.45);
  ctx.lineTo(cx, cy + bodyH * 0.45 + flameH);
  ctx.lineTo(cx + halfW * 1.15, cy + bodyH * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = prevFill;
  ctx.strokeStyle = prevStroke;
}

export function ExcavatorMinimap({
  simRef,
  terrainRef,
  tutorialStepRef,
  tutorialWaypointRef,
  worldPickupsRef,
  visible,
  embedded = false,
  displaySize = DEFAULT_DISPLAY_SIZE,
  monumentPhase = "locked",
}: ExcavatorMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { displaySize: size, pad, shellRadius, innerStrokeRadius } =
      getMinimapLayout(displaySize);
    const inset = Math.max(4, Math.round(5 * (size / DEFAULT_DISPLAY_SIZE)));

    let raf = 0;
    let ctx = setupHiDpiCanvas(canvas, size);
    if (!ctx) return;

    const draw = () => {
      if (!ctx) return;
      const context = ctx;
      const sim = simRef.current;
      const terrain = terrainRef.current;
      const wp =
        tutorialWaypointRef?.current ?? tutorialStepRef.current?.waypoint ?? null;
      const bounds = getMapWorldBounds(terrain);

      context.clearRect(0, 0, size, size);

      const shell = context.createLinearGradient(0, 0, size, size);
      shell.addColorStop(0, "#2b3038");
      shell.addColorStop(0.46, "#101319");
      shell.addColorStop(1, "#050609");
      context.fillStyle = shell;
      context.beginPath();
      context.roundRect(0, 0, size, size, shellRadius);
      context.fill();

      context.strokeStyle = "rgba(229,57,53,0.95)";
      context.lineWidth = 2;
      context.stroke();
      context.strokeStyle = "rgba(255,255,255,0.22)";
      context.lineWidth = 1;
      context.beginPath();
      context.roundRect(
        inset,
        inset,
        size - inset * 2,
        size - inset * 2,
        innerStrokeRadius,
      );
      context.stroke();

      const inner = size - pad * 2;
      context.strokeStyle = "rgba(255,255,255,0.1)";
      context.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const p = pad + (inner / 4) * i;
        context.beginPath();
        context.moveTo(p + 0.5, pad);
        context.lineTo(p + 0.5, size - pad);
        context.moveTo(pad, p + 0.5);
        context.lineTo(size - pad, p + 0.5);
        context.stroke();
      }

      const digZones = getActiveDigZones(terrain);

      for (const zone of digZones) {
        const dig = worldToMinimap(zone.x, zone.z, bounds, size, pad);
        const digR = (zone.radius / (bounds.maxX - bounds.minX)) * inner;
        context.fillStyle = "rgba(255,143,0,0.32)";
        context.beginPath();
        context.arc(dig.px, dig.py, Math.max(digR, 4.5 * (size / DEFAULT_DISPLAY_SIZE)), 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "#ffb300";
        context.lineWidth = 2;
        context.stroke();
        context.fillStyle = "#fff3c4";
        context.beginPath();
        context.arc(dig.px, dig.py, 3.5 * (size / DEFAULT_DISPLAY_SIZE), 0, Math.PI * 2);
        context.fill();
      }

      if (terrain.crashZone?.active) {
        const crash = worldToMinimap(
          terrain.crashZone.centerX,
          terrain.crashZone.centerZ,
          bounds,
          size,
          pad,
        );
        const width =
          (terrain.crashZone.width / (bounds.maxX - bounds.minX)) * inner;
        const depth =
          (terrain.crashZone.depth / (bounds.maxZ - bounds.minZ)) * inner;
        context.fillStyle = "rgba(245,158,11,0.42)";
        context.fillRect(
          crash.px - width / 2,
          crash.py - depth / 2,
          width,
          depth,
        );
        context.strokeStyle = "#fbbf24";
        context.strokeRect(
          crash.px - width / 2,
          crash.py - depth / 2,
          width,
          depth,
        );
      }

      if (terrain.hillZone?.active) {
        const hill = worldToMinimap(
          terrain.hillZone.centerX,
          terrain.hillZone.centerZ,
          bounds,
          size,
          pad,
        );
        const radius =
          (terrain.hillZone.radius / (bounds.maxX - bounds.minX)) * inner;
        context.fillStyle = "rgba(148,163,184,0.3)";
        context.beginPath();
        context.arc(hill.px, hill.py, Math.max(radius, 5), 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "#cbd5e1";
        context.stroke();
      }

      const dump = worldToMinimap(DUMP_ZONE.x, DUMP_ZONE.z, bounds, size, pad);
      const dumpR = (DUMP_ZONE.radius / (bounds.maxX - bounds.minX)) * inner;
      context.fillStyle = "rgba(76,175,80,0.3)";
      context.beginPath();
      context.arc(dump.px, dump.py, Math.max(dumpR, 3.5 * (size / DEFAULT_DISPLAY_SIZE)), 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#81c784";
      context.lineWidth = 2;
      context.stroke();
      const dumpMark = 3.5 * (size / DEFAULT_DISPLAY_SIZE);
      context.fillStyle = "#c8e6c9";
      context.fillRect(dump.px - dumpMark, dump.py - dumpMark, dumpMark * 2, dumpMark * 2);

      const repair = worldToMinimap(REPAIR_TENT.x, REPAIR_TENT.z, bounds, size, pad);
      const repairR =
        (REPAIR_TENT.radius / (bounds.maxX - bounds.minX)) * inner;
      const repairScale = size / DEFAULT_DISPLAY_SIZE;
      context.fillStyle = "rgba(196,163,90,0.28)";
      context.beginPath();
      context.arc(
        repair.px,
        repair.py,
        Math.max(repairR, 4.2 * repairScale),
        0,
        Math.PI * 2,
      );
      context.fill();
      context.strokeStyle = "#e8c56a";
      context.lineWidth = 2;
      context.stroke();
      // Tent mark (chevron roof)
      const roof = 4.2 * repairScale;
      context.beginPath();
      context.moveTo(repair.px, repair.py - roof);
      context.lineTo(repair.px + roof * 0.9, repair.py + roof * 0.15);
      context.lineTo(repair.px - roof * 0.9, repair.py + roof * 0.15);
      context.closePath();
      context.fillStyle = "#f5d78e";
      context.fill();
      context.strokeStyle = "#8b1e1e";
      context.lineWidth = Math.max(1, 1.2 * repairScale);
      context.stroke();

      if (monumentPhase !== "locked") {
        const mon = worldToMinimap(
          SITE_LAYOUT.monument[0],
          SITE_LAYOUT.monument[1],
          bounds,
          size,
          pad,
        );
        context.fillStyle =
          monumentPhase === "active" ? "#e30613" : "#fbbf24";
        context.fillRect(
          mon.px - 3.5 * repairScale,
          mon.py - 5.5 * repairScale,
          7 * repairScale,
          11 * repairScale,
        );
        context.strokeStyle = "#ffffff";
        context.lineWidth = Math.max(1, 1.1 * repairScale);
        context.strokeRect(
          mon.px - 3.5 * repairScale,
          mon.py - 5.5 * repairScale,
          7 * repairScale,
          11 * repairScale,
        );
      }

      const pickups = worldPickupsRef?.current?.active;
      if (pickups && pickups.length > 0) {
        const s = size / DEFAULT_DISPLAY_SIZE;
        for (const pickup of pickups) {
          const p = worldToMinimap(pickup.x, pickup.z, bounds, size, pad);
          context.lineWidth = Math.max(1, 1.05 * s);
          if (pickup.kind === "star") {
            context.fillStyle = "#ffd24a";
            context.strokeStyle = "#fff6c8";
            drawMinimapStar(context, p.px, p.py, 3.4 * s);
          } else {
            context.fillStyle = "#2a9d8f";
            context.strokeStyle = "#e9f5f3";
            drawMinimapBooster(context, p.px, p.py, s);
          }
        }
      }

      if (wp) {
        const goal = worldToMinimap(wp.x, wp.z, bounds, size, pad);
        const pulse = 0.7 + Math.sin(Date.now() / 200) * 0.3;
        context.fillStyle = `rgba(41,182,246,${pulse})`;
        context.beginPath();
        context.arc(goal.px, goal.py, 6.5 * (size / DEFAULT_DISPLAY_SIZE), 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "#e1f5fe";
        context.lineWidth = 2;
        context.stroke();
      }

      const player = worldToMinimap(sim.posX, sim.posZ, bounds, size, pad);
      const facing = sim.heading + sim.swing;
      const dirX = Math.sin(facing);
      // Canvas Y grows downward; negate so heading 0 (+Z north) points up.
      const dirY = -Math.cos(facing);
      const nx = -dirY;
      const ny = dirX;
      const markerScale = size / DEFAULT_DISPLAY_SIZE;
      const px = player.px;
      const py = player.py;

      // High-contrast facing arrow (GPS-style) so heading stays readable on the small map.
      const tipLen = 11 * markerScale;
      const tailLen = 5.5 * markerScale;
      const halfW = 5.2 * markerScale;
      const tipX = px + dirX * tipLen;
      const tipY = py + dirY * tipLen;
      const leftX = px - dirX * tailLen + nx * halfW;
      const leftY = py - dirY * tailLen + ny * halfW;
      const rightX = px - dirX * tailLen - nx * halfW;
      const rightY = py - dirY * tailLen - ny * halfW;
      const notchX = px - dirX * (tailLen * 0.35);
      const notchY = py - dirY * (tailLen * 0.35);

      context.save();
      context.shadowColor = "rgba(0,0,0,0.65)";
      context.shadowBlur = 5 * markerScale;
      context.shadowOffsetY = 1;

      context.beginPath();
      context.moveTo(tipX, tipY);
      context.lineTo(leftX, leftY);
      context.lineTo(notchX, notchY);
      context.lineTo(rightX, rightY);
      context.closePath();

      context.fillStyle = "#ff2d2d";
      context.fill();
      context.shadowBlur = 0;
      context.shadowOffsetY = 0;
      context.lineJoin = "round";
      context.lineWidth = Math.max(1.6, 2.2 * markerScale);
      context.strokeStyle = "rgba(255,255,255,0.95)";
      context.stroke();
      context.lineWidth = Math.max(0.7, 1.1 * markerScale);
      context.strokeStyle = "rgba(120,0,0,0.85)";
      context.stroke();

      // Bright tip highlight for facing direction.
      context.fillStyle = "#ffe082";
      context.beginPath();
      context.arc(tipX, tipY, Math.max(1.4, 1.9 * markerScale), 0, Math.PI * 2);
      context.fill();
      context.restore();

      raf = requestAnimationFrame(draw);
    };

    const onResize = () => {
      ctx = setupHiDpiCanvas(canvas, size) ?? ctx;
    };

    window.addEventListener("resize", onResize);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [visible, displaySize, monumentPhase, simRef, terrainRef, tutorialStepRef, tutorialWaypointRef]);

  if (!visible) return null;

  const legendItems = [
    { label: "굴착", swatch: "bg-amber-400 ring-1 ring-amber-200/80" },
    { label: "하역", swatch: "bg-emerald-400 ring-1 ring-emerald-200/70" },
    { label: "철거", swatch: "bg-amber-500 ring-1 ring-yellow-300/70" },
    { label: "석재", swatch: "bg-slate-300 ring-1 ring-slate-100/70" },
    { label: "정비", swatch: "bg-amber-200 ring-1 ring-yellow-100/80" },
    { label: "조형", swatch: "bg-red-500 ring-1 ring-red-200/80" },
  ] as const;

  return (
    <div
      className={
        embedded
          ? "pointer-events-none flex w-full flex-col items-stretch"
          : "pointer-events-none absolute right-1.5 top-1.5 z-20 flex flex-col items-stretch overflow-hidden rounded-xl border border-white/15 bg-black/60 shadow-lg backdrop-blur-sm"
      }
    >
      <canvas
        ref={canvasRef}
        className="block"
        aria-label="미니맵"
      />
      <ul
        className="grid w-full grid-cols-2 gap-x-1 gap-y-0.5 border-t border-white/10 px-1 py-0.5"
        aria-label="미니맵 범례"
      >
        {legendItems.map((item) => (
          <li
            key={item.label}
            className="flex min-w-0 items-center justify-center gap-0.5 text-[7px] font-bold leading-none text-white/85"
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.swatch}`}
              aria-hidden
            />
            <span className="truncate">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
