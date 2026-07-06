"use client";

import { useEffect, useRef } from "react";
import type { ExcavatorSimState } from "./ExcavatorScene";
import type { TerrainData } from "./terrain";
import { DIG_ZONE, DUMP_ZONE, getMapWorldBounds } from "./terrain";
import type { TutorialStep } from "./tutorial";

interface ExcavatorMinimapProps {
  simRef: React.RefObject<ExcavatorSimState>;
  terrainRef: React.RefObject<TerrainData>;
  tutorialStepRef: React.RefObject<TutorialStep | null>;
  visible: boolean;
}

const SIZE = 88;
const PAD = 6;

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
    py: PAD + (1 - nz) * inner,
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

      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.beginPath();
      ctx.roundRect(0, 0, SIZE, SIZE, 8);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const inner = SIZE - PAD * 2;

      // 굴착 구역
      const dig = worldToMinimap(DIG_ZONE.x, DIG_ZONE.z, bounds);
      const digR = (DIG_ZONE.radius / (bounds.maxX - bounds.minX)) * inner;
      ctx.fillStyle = "rgba(255,152,0,0.35)";
      ctx.beginPath();
      ctx.arc(dig.px, dig.py, Math.max(digR, 4), 0, Math.PI * 2);
      ctx.fill();

      // 덤프 구역
      const dump = worldToMinimap(DUMP_ZONE.x, DUMP_ZONE.z, bounds);
      const dumpR = (DUMP_ZONE.radius / (bounds.maxX - bounds.minX)) * inner;
      ctx.fillStyle = "rgba(76,175,80,0.35)";
      ctx.beginPath();
      ctx.arc(dump.px, dump.py, Math.max(dumpR, 3), 0, Math.PI * 2);
      ctx.fill();

      // 목표 지점
      if (wp) {
        const goal = worldToMinimap(wp.x, wp.z, bounds);
        const pulse = 0.7 + Math.sin(Date.now() / 200) * 0.3;
        ctx.fillStyle = `rgba(41,182,246,${pulse})`;
        ctx.beginPath();
        ctx.arc(goal.px, goal.py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 플레이어 — 주행·시선 방향 (sin, cos)과 동일하게 화살표 그리기
      const player = worldToMinimap(sim.posX, sim.posZ, bounds);
      const facing = sim.heading + sim.swing;
      const dirX = Math.sin(facing);
      const dirY = -Math.cos(facing);
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
      ctx.fillStyle = "#ef5350";
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(bx + nx * halfW, by + ny * halfW);
      ctx.lineTo(bx - nx * halfW, by - ny * halfW);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [visible, simRef, terrainRef, tutorialStepRef]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute right-2 top-2 z-20">
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        className="rounded-lg border border-white/20 shadow-lg"
        aria-label="미니맵"
      />
    </div>
  );
}
