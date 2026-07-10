"use client";

import { useEffect, useRef } from "react";
import type { ExcavatorSimState } from "./ExcavatorScene";
import type { TerrainData } from "./terrain";
import { DUMP_ZONE, getActiveDigZones, getMapWorldBounds } from "./terrain";
import type { TutorialStep } from "./tutorial";

interface ExcavatorMinimapProps {
  simRef: React.RefObject<ExcavatorSimState>;
  terrainRef: React.RefObject<TerrainData>;
  tutorialStepRef: React.RefObject<TutorialStep | null>;
  visible: boolean;
  /** 가로 HUD 스택 안에 넣을 때 absolute 포지션 제거 */
  embedded?: boolean;
  /** 세로 HUD 등 공간이 좁을 때 캔버스 한 변 길이(px) */
  displaySize?: number;
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
    py: pad + nz * inner,
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

export function ExcavatorMinimap({
  simRef,
  terrainRef,
  tutorialStepRef,
  visible,
  embedded = false,
  displaySize = DEFAULT_DISPLAY_SIZE,
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
      const wp = tutorialStepRef.current?.waypoint;
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
      const labelScale = size / DEFAULT_DISPLAY_SIZE;
      const drawZoneLabel = (label: string, x: number, y: number, color: string) => {
        context.save();
        context.font = `900 ${Math.max(8, Math.round(10 * labelScale))}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.lineWidth = Math.max(2, 3 * labelScale);
        context.strokeStyle = "rgba(0,0,0,0.78)";
        context.fillStyle = color;
        context.strokeText(label, x, y);
        context.fillText(label, x, y);
        context.restore();
      };

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
        drawZoneLabel("굴착", dig.px, dig.py - Math.max(digR * 0.3, 7 * labelScale), "#ffecb3");
      }

      if (terrain.crashZone) {
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
        context.fillStyle = terrain.crashZone.active
          ? "rgba(245,158,11,0.42)"
          : "rgba(100,116,139,0.28)";
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
        drawZoneLabel("CRASH", crash.px, crash.py - depth / 2 - 5, "#fde68a");
      }

      if (terrain.hillZone) {
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
        drawZoneLabel("STONE", hill.px, hill.py - radius - 5, "#e2e8f0");
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
      drawZoneLabel("하역", dump.px, dump.py - Math.max(dumpR * 0.3, 7 * labelScale), "#d9fdd3");

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
      const dirY = Math.cos(facing);
      const markerScale = size / DEFAULT_DISPLAY_SIZE;
      const tipLen = 7 * markerScale;
      const baseLen = 4 * markerScale;
      const halfW = 3.5 * markerScale;
      const px = player.px;
      const py = player.py;
      const tx = px + dirX * tipLen;
      const ty = py + dirY * tipLen;
      const bx = px + dirX * (tipLen - baseLen);
      const by = py + dirY * (tipLen - baseLen);
      const nx = -dirY;
      const ny = dirX;
      context.shadowColor = "rgba(239,83,80,0.55)";
      context.shadowBlur = 4;
      context.fillStyle = "#ef5350";
      context.beginPath();
      context.moveTo(tx, ty);
      context.lineTo(bx + nx * halfW, by + ny * halfW);
      context.lineTo(bx - nx * halfW, by - ny * halfW);
      context.closePath();
      context.fill();
      context.shadowBlur = 0;
      context.fillStyle = "rgba(255,255,255,0.9)";
      context.beginPath();
      context.arc(px, py, 2 * markerScale, 0, Math.PI * 2);
      context.fill();

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
  }, [visible, displaySize, simRef, terrainRef, tutorialStepRef]);

  if (!visible) return null;

  return (
    <div
      className={
        embedded
          ? "pointer-events-none rounded-2xl border border-white/10 bg-black/55 p-1 shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
          : "pointer-events-none absolute right-2 top-11 z-20 rounded-2xl border border-white/10 bg-black/55 p-1 shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
      }
    >
      <canvas
        ref={canvasRef}
        className="block rounded-2xl"
        aria-label="미니맵"
      />
    </div>
  );
}
