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
}

const SIZE = 108;
const PAD = 10;

function worldToMinimap(
  x: number,
  z: number,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
) {
  const inner = SIZE - PAD * 2;
  const nx = (x - bounds.minX) / (bounds.maxX - bounds.minX);
  const nz = (z - bounds.minZ) / (bounds.maxZ - bounds.minZ);
  return {
    px: PAD + nx * inner,
    py: PAD + nz * inner,
  };
}

export function ExcavatorMinimap({
  simRef,
  terrainRef,
  tutorialStepRef,
  visible,
}: ExcavatorMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      const sim = simRef.current;
      const terrain = terrainRef.current;
      const wp = tutorialStepRef.current?.waypoint;
      const bounds = getMapWorldBounds(terrain);

      ctx.clearRect(0, 0, SIZE, SIZE);

      const shell = ctx.createLinearGradient(0, 0, SIZE, SIZE);
      shell.addColorStop(0, "#2b3038");
      shell.addColorStop(0.46, "#101319");
      shell.addColorStop(1, "#050609");
      ctx.fillStyle = shell;
      ctx.beginPath();
      ctx.roundRect(0, 0, SIZE, SIZE, 14);
      ctx.fill();

      ctx.strokeStyle = "rgba(229,57,53,0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(5, 5, SIZE - 10, SIZE - 10, 10);
      ctx.stroke();

      const inner = SIZE - PAD * 2;
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const p = PAD + (inner / 4) * i;
        ctx.beginPath();
        ctx.moveTo(p, PAD);
        ctx.lineTo(p, SIZE - PAD);
        ctx.moveTo(PAD, p);
        ctx.lineTo(SIZE - PAD, p);
        ctx.stroke();
      }

      // 굴착 구역
      const digZones = getActiveDigZones(terrain);
      let firstDigLabel: { px: number; py: number; r: number } | null = null;
      for (const zone of digZones) {
        const dig = worldToMinimap(zone.x, zone.z, bounds);
        const digR = (zone.radius / (bounds.maxX - bounds.minX)) * inner;
        firstDigLabel ??= { px: dig.px, py: dig.py, r: digR };
        ctx.fillStyle = "rgba(255,143,0,0.28)";
        ctx.beginPath();
        ctx.arc(dig.px, dig.py, Math.max(digR, 4), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffb300";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#fff3c4";
        ctx.beginPath();
        ctx.arc(dig.px, dig.py, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // 덤프 구역
      const dump = worldToMinimap(DUMP_ZONE.x, DUMP_ZONE.z, bounds);
      const dumpR = (DUMP_ZONE.radius / (bounds.maxX - bounds.minX)) * inner;
      ctx.fillStyle = "rgba(76,175,80,0.25)";
      ctx.beginPath();
      ctx.arc(dump.px, dump.py, Math.max(dumpR, 3), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#81c784";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#c8e6c9";
      ctx.fillRect(dump.px - 3, dump.py - 3, 6, 6);

      // 목표 지점
      if (wp) {
        const goal = worldToMinimap(wp.x, wp.z, bounds);
        const pulse = 0.7 + Math.sin(Date.now() / 200) * 0.3;
        ctx.fillStyle = `rgba(41,182,246,${pulse})`;
        ctx.beginPath();
        ctx.arc(goal.px, goal.py, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#e1f5fe";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 플레이어 — 주행·시선 방향 (sin, cos)과 동일하게 화살표 그리기
      const player = worldToMinimap(sim.posX, sim.posZ, bounds);
      const facing = sim.heading + sim.swing;
      const dirX = Math.sin(facing);
      const dirY = Math.cos(facing);
      const tipLen = 6;
      const baseLen = 3.5;
      const halfW = 3.2;
      const px = player.px;
      const py = player.py;
      const tx = px + dirX * tipLen;
      const ty = py + dirY * tipLen;
      const bx = px + dirX * (tipLen - baseLen);
      const by = py + dirY * (tipLen - baseLen);
      const nx = -dirY;
      const ny = dirX;
      ctx.shadowColor = "rgba(239,83,80,0.75)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#ef5350";
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(bx + nx * halfW, by + ny * halfW);
      ctx.lineTo(bx - nx * halfW, by - ny * halfW);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "700 8px sans-serif";
      if (firstDigLabel) {
        ctx.fillText(
          "DIG",
          Math.max(7, firstDigLabel.px - 8),
          Math.max(11, firstDigLabel.py - firstDigLabel.r - 3),
        );
      }
      ctx.fillText("DUMP", Math.min(SIZE - 28, dump.px - 12), Math.max(11, dump.py - dumpR - 3));

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [visible, simRef, terrainRef, tutorialStepRef]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute right-2 top-11 z-20 rounded-2xl bg-black/35 p-1 shadow-[0_8px_20px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        className="rounded-2xl"
        aria-label="미니맵"
      />
    </div>
  );
}
