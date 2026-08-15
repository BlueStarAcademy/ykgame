"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { ExcavatorSimState } from "./ExcavatorScene";
import type { TerrainData } from "./terrain";
import { DUMP_ZONE, getActiveDigZones, getMapWorldBounds } from "./terrain";
import type { TutorialStep, TutorialWaypoint } from "./tutorial";
import { REPAIR_TENT } from "./gearCatalog";
import { SITE_LAYOUT } from "./siteLayout";
import type { MonumentPhase } from "./monument/types";
import type { WorldPickupsState } from "./worldPickups";
import { getGraphicsProfile } from "./graphicsQuality";

const MINIMAP_GFX = getGraphicsProfile();

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
  /** 범례 표시 (확대 모달에서는 별도 UI로 대체 가능) */
  showLegend?: boolean;
  /** 캔버스 위 지역명 콜아웃 표시 여부 */
  showRegionLabels?: boolean;
  /** 탭/클릭 시 맵 확대 */
  onExpand?: () => void;
  /** Lv.25+ sports meet portal marker */
  sportsMeetUnlocked?: boolean;
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
    // Flip X+Z together (180° map rotation) so north stays at 12 o'clock
    // without mirroring turn direction after the north-up correction.
    px: pad + (1 - nx) * inner,
    py: pad + (1 - nz) * inner,
  };
}

function setupHiDpiCanvas(canvas: HTMLCanvasElement, displaySize: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const dpr = Math.min(
    window.devicePixelRatio || 1,
    MINIMAP_GFX.minimapMaxDpr,
  );
  const bufW = Math.round(displaySize * dpr);
  const bufH = Math.round(displaySize * dpr);
  // Assigning width/height resets the context (including transform).
  if (canvas.width !== bufW) canvas.width = bufW;
  if (canvas.height !== bufH) canvas.height = bufH;
  canvas.style.width = `${displaySize}px`;
  canvas.style.height = `${displaySize}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  return { ctx, dpr };
}

/** DPR/컨텍스트 유실 후에도 CSS 픽셀 좌표계를 유지한다 (미니맵 1/4 축소 방지). */
function ensureMinimapHiDpi(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  displaySize: number,
): CanvasRenderingContext2D {
  const dpr = Math.min(
    window.devicePixelRatio || 1,
    MINIMAP_GFX.minimapMaxDpr,
  );
  const bufW = Math.round(displaySize * dpr);
  const bufH = Math.round(displaySize * dpr);
  if (canvas.width !== bufW || canvas.height !== bufH) {
    return setupHiDpiCanvas(canvas, displaySize)?.ctx ?? ctx;
  }
  // width 미변경이어도 GPU 컨텍스트 복구 등으로 transform이 identity로 돌아갈 수 있음
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

type MapMarkerIcon =
  | "dig"
  | "dump"
  | "crash"
  | "hill"
  | "flood"
  | "repair"
  | "sports"
  | "monument";

/**
 * Readable at the HUD scale and detailed enough for the expanded map.
 * The pin is drawn over each translucent work area; labels live in the
 * external modal legend so they never obscure the map itself.
 */
function drawMinimapMapMarker(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  icon: MapMarkerIcon,
  tone: string,
  scale: number,
) {
  const radius = Math.max(4.5, 6.3 * scale);
  const line = Math.max(1, 1.15 * scale);

  ctx.save();
  ctx.shadowColor = `${tone}99`;
  ctx.shadowBlur = 5 * scale;
  ctx.fillStyle = "rgba(8, 12, 18, 0.94)";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = tone;
  ctx.lineWidth = line;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = Math.max(0.55, line * 0.45);
  ctx.beginPath();
  ctx.arc(cx, cy, radius - line * 1.1, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#f8fafc";
  ctx.fillStyle = "#f8fafc";
  ctx.lineWidth = Math.max(1, 1.2 * scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (icon === "dig") {
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.38, cy - radius * 0.42);
    ctx.lineTo(cx + radius * 0.18, cy + radius * 0.16);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - radius * 0.43, cy - radius * 0.47, radius * 0.14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.08, cy + radius * 0.05);
    ctx.lineTo(cx + radius * 0.48, cy + radius * 0.28);
    ctx.lineTo(cx + radius * 0.14, cy + radius * 0.53);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (icon === "dump") {
    ctx.strokeRect(cx - radius * 0.42, cy - radius * 0.18, radius * 0.84, radius * 0.5);
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.5, cy - radius * 0.23);
    ctx.lineTo(cx + radius * 0.5, cy - radius * 0.23);
    ctx.stroke();
    ctx.fillStyle = tone;
    ctx.fillRect(cx - radius * 0.25, cy - radius * 0.58, radius * 0.5, radius * 0.24);
  } else if (icon === "crash") {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius * 0.58);
    ctx.lineTo(cx + radius * 0.55, cy + radius * 0.43);
    ctx.lineTo(cx - radius * 0.55, cy + radius * 0.43);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#101319";
    ctx.fillRect(cx - line * 0.45, cy - radius * 0.2, line * 0.9, radius * 0.38);
    ctx.beginPath();
    ctx.arc(cx, cy + radius * 0.25, line * 0.55, 0, Math.PI * 2);
    ctx.fill();
  } else if (icon === "hill") {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.56, cy + radius * 0.38);
    ctx.lineTo(cx - radius * 0.1, cy - radius * 0.43);
    ctx.lineTo(cx + radius * 0.08, cy - radius * 0.08);
    ctx.lineTo(cx + radius * 0.34, cy - radius * 0.32);
    ctx.lineTo(cx + radius * 0.6, cy + radius * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (icon === "flood") {
    ctx.strokeStyle = tone;
    for (const offset of [-0.28, 0.1, 0.48]) {
      ctx.beginPath();
      ctx.moveTo(cx - radius * 0.58, cy + radius * offset);
      ctx.quadraticCurveTo(
        cx - radius * 0.3,
        cy + radius * (offset - 0.19),
        cx,
        cy + radius * offset,
      );
      ctx.quadraticCurveTo(
        cx + radius * 0.3,
        cy + radius * (offset + 0.19),
        cx + radius * 0.58,
        cy + radius * offset,
      );
      ctx.stroke();
    }
  } else if (icon === "repair") {
    ctx.strokeStyle = tone;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.42, cy + radius * 0.42);
    ctx.lineTo(cx + radius * 0.26, cy - radius * 0.26);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + radius * 0.3, cy - radius * 0.31, radius * 0.24, 0.2, Math.PI * 1.65);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - radius * 0.43, cy + radius * 0.43, radius * 0.12, 0, Math.PI * 2);
    ctx.stroke();
  } else if (icon === "sports") {
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.35, cy + radius * 0.53);
    ctx.lineTo(cx - radius * 0.35, cy - radius * 0.57);
    ctx.stroke();
    ctx.fillStyle = tone;
    ctx.fillRect(cx - radius * 0.28, cy - radius * 0.5, radius * 0.7, radius * 0.52);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(cx - radius * 0.28, cy - radius * 0.5, radius * 0.18, radius * 0.17);
    ctx.fillRect(cx + radius * 0.08, cy - radius * 0.33, radius * 0.18, radius * 0.17);
  } else {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius * 0.6);
    ctx.lineTo(cx + radius * 0.32, cy - radius * 0.1);
    ctx.lineTo(cx + radius * 0.22, cy + radius * 0.52);
    ctx.lineTo(cx - radius * 0.22, cy + radius * 0.52);
    ctx.lineTo(cx - radius * 0.32, cy - radius * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e30613";
    ctx.beginPath();
    ctx.arc(cx, cy - radius * 0.23, Math.max(0.8, radius * 0.12), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Expanded maps have room for a small map-callout. Keeping these in the
 * canvas means labels stay precisely attached to their moving/active regions
 * without introducing a second coordinate system in the HUD.
 */
function drawMinimapRegionLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  tone: string,
  displaySize: number,
) {
  if (displaySize < 180) return;

  const scale = displaySize / DEFAULT_DISPLAY_SIZE;
  const fontSize = Math.max(8.5, 9.5 * scale);
  const padX = Math.max(4, 4.5 * scale);
  const chipH = Math.max(16, 17 * scale);
  const gap = Math.max(5, 6 * scale);
  const maxX = displaySize - 8 * scale;

  ctx.save();
  ctx.font = `800 ${fontSize}px "Noto Sans KR", "Malgun Gothic", sans-serif`;
  const chipW = Math.ceil(ctx.measureText(label).width + padX * 2 + 7 * scale);
  const placeLeft = x > displaySize * 0.57;
  const rawChipX = placeLeft ? x - gap - chipW : x + gap;
  const chipX = Math.min(maxX - chipW, Math.max(8 * scale, rawChipX));
  const chipY = Math.min(
    displaySize - 8 * scale - chipH,
    Math.max(8 * scale, y - chipH / 2),
  );
  const connectorEndX = placeLeft ? chipX + chipW : chipX;
  const connectorY = chipY + chipH / 2;
  const dotR = Math.max(1.5, 1.9 * scale);

  ctx.strokeStyle = tone;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = Math.max(0.8, scale);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(connectorEndX, connectorY);
  ctx.stroke();

  const background = ctx.createLinearGradient(chipX, chipY, chipX, chipY + chipH);
  background.addColorStop(0, "rgba(31, 38, 49, 0.94)");
  background.addColorStop(1, "rgba(6, 9, 14, 0.94)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.roundRect(chipX, chipY, chipW, chipH, chipH / 2);
  ctx.fill();
  ctx.strokeStyle = tone;
  ctx.globalAlpha = 0.72;
  ctx.lineWidth = Math.max(0.75, 0.85 * scale);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.arc(chipX + padX, connectorY, dotR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f8fafc";
  ctx.textBaseline = "middle";
  ctx.fillText(label, chipX + padX + dotR * 2.6, connectorY + 0.25 * scale);
  ctx.restore();
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
  showLegend = false,
  showRegionLabels = true,
  onExpand,
  sportsMeetUnlocked = false,
}: ExcavatorMinimapProps) {
  const t = useTranslations("yanmar.map");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { displaySize: size, pad, shellRadius, innerStrokeRadius } =
      getMinimapLayout(displaySize);
    const inset = Math.max(4, Math.round(5 * (size / DEFAULT_DISPLAY_SIZE)));

    let raf = 0;
    let ctx = setupHiDpiCanvas(canvas, size)?.ctx ?? null;
    if (!ctx) return;
    let lastDraw = 0;
    const minFrameMs = 1000 / Math.max(1, MINIMAP_GFX.minimapFps);

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - lastDraw < minFrameMs) return;
      lastDraw = now;
      ctx = ensureMinimapHiDpi(canvas, ctx!, size);
      const context = ctx;
      const sim = simRef.current;
      const terrain = terrainRef.current;
      if (!sim || !terrain) {
        return;
      }
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
        const zoneRadius = Math.max(digR, 4.5 * (size / DEFAULT_DISPLAY_SIZE));
        const digGlow = context.createRadialGradient(
          dig.px,
          dig.py,
          1,
          dig.px,
          dig.py,
          zoneRadius * 1.4,
        );
        digGlow.addColorStop(0, "rgba(255, 245, 199, 0.62)");
        digGlow.addColorStop(0.35, "rgba(255, 179, 0, 0.38)");
        digGlow.addColorStop(1, "rgba(255, 143, 0, 0)");
        context.fillStyle = digGlow;
        context.beginPath();
        context.arc(dig.px, dig.py, zoneRadius * 1.4, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "rgba(255,143,0,0.26)";
        context.beginPath();
        context.arc(dig.px, dig.py, zoneRadius, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "#ffb300";
        context.lineWidth = 2;
        context.stroke();
        context.fillStyle = "#fff3c4";
        context.beginPath();
        context.arc(dig.px, dig.py, 3.5 * (size / DEFAULT_DISPLAY_SIZE), 0, Math.PI * 2);
        context.fill();
        drawMinimapMapMarker(context, dig.px, dig.py, "dig", "#ffd166", size / DEFAULT_DISPLAY_SIZE);
        if (showRegionLabels) {
          drawMinimapRegionLabel(context, dig.px, dig.py, t("world.dig"), "#ffd166", size);
        }
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
        context.strokeStyle = "rgba(255, 248, 214, 0.55)";
        context.lineWidth = Math.max(0.6, size / 200);
        for (let stripe = -depth; stripe < width; stripe += 5 * (size / DEFAULT_DISPLAY_SIZE)) {
          context.beginPath();
          context.moveTo(crash.px - width / 2 + stripe, crash.py + depth / 2);
          context.lineTo(crash.px - width / 2 + stripe + depth, crash.py - depth / 2);
          context.stroke();
        }
        drawMinimapMapMarker(context, crash.px, crash.py, "crash", "#fbbf24", size / DEFAULT_DISPLAY_SIZE);
        if (showRegionLabels) {
          drawMinimapRegionLabel(context, crash.px, crash.py, t("world.crash"), "#fbbf24", size);
        }
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
        context.fillStyle = "rgba(248, 250, 252, 0.9)";
        context.beginPath();
        context.moveTo(hill.px - radius * 0.42, hill.py + radius * 0.22);
        context.lineTo(hill.px, hill.py - radius * 0.34);
        context.lineTo(hill.px + radius * 0.42, hill.py + radius * 0.22);
        context.closePath();
        context.fill();
        drawMinimapMapMarker(context, hill.px, hill.py, "hill", "#dbeafe", size / DEFAULT_DISPLAY_SIZE);
        if (showRegionLabels) {
          drawMinimapRegionLabel(context, hill.px, hill.py, t("world.hill"), "#dbeafe", size);
        }
      }

      if (terrain.floodZone) {
        const flood = worldToMinimap(
          terrain.floodZone.centerX,
          terrain.floodZone.centerZ,
          bounds,
          size,
          pad,
        );
        const radius =
          (terrain.floodZone.radius / (bounds.maxX - bounds.minX)) * inner;
        const floodR = Math.max(radius * 0.55, 5);
        context.fillStyle = "rgba(14,165,233,0.28)";
        context.beginPath();
        context.arc(flood.px, flood.py, floodR, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "#38bdf8";
        context.lineWidth = 2;
        context.stroke();
        // Incinerator mark
        const incinerator = worldToMinimap(
          terrain.floodZone.incineratorX,
          terrain.floodZone.incineratorZ,
          bounds,
          size,
          pad,
        );
        context.fillStyle = "#f97316";
        context.fillRect(incinerator.px - 2.5, incinerator.py - 3.5, 5, 7);
        drawMinimapMapMarker(context, flood.px, flood.py, "flood", "#7dd3fc", size / DEFAULT_DISPLAY_SIZE);
        if (showRegionLabels) {
          drawMinimapRegionLabel(
            context,
            flood.px,
            flood.py,
            t("world.flood"),
            "#7dd3fc",
            size,
          );
        }
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
      context.save();
      context.translate(dump.px, dump.py);
      context.rotate(Math.PI / 4);
      context.fillRect(-dumpMark, -dumpMark, dumpMark * 2, dumpMark * 2);
      context.restore();
      drawMinimapMapMarker(context, dump.px, dump.py, "dump", "#a7f3d0", size / DEFAULT_DISPLAY_SIZE);
      if (showRegionLabels) {
        drawMinimapRegionLabel(context, dump.px, dump.py, t("world.dump"), "#a7f3d0", size);
      }

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
      drawMinimapMapMarker(context, repair.px, repair.py, "repair", "#f5d78e", repairScale);
      if (showRegionLabels) {
        drawMinimapRegionLabel(context, repair.px, repair.py, t("world.repair"), "#f5d78e", size);
      }

      if (sportsMeetUnlocked) {
        const portal = worldToMinimap(
          SITE_LAYOUT.sportsPortal[0],
          SITE_LAYOUT.sportsPortal[1],
          bounds,
          size,
          pad,
        );
        const pr = 5 * repairScale;
        context.beginPath();
        context.arc(portal.px, portal.py, pr, 0, Math.PI * 2);
        context.fillStyle = "#38bdf8";
        context.fill();
        context.strokeStyle = "#0ea5e9";
        context.lineWidth = Math.max(1, 1.4 * repairScale);
        context.stroke();
        context.beginPath();
        context.arc(portal.px, portal.py, pr * 0.45, 0, Math.PI * 2);
        context.fillStyle = "#fbbf24";
        context.fill();
        drawMinimapMapMarker(context, portal.px, portal.py, "sports", "#7dd3fc", repairScale);
        if (showRegionLabels) {
          drawMinimapRegionLabel(context, portal.px, portal.py, t("world.sports"), "#7dd3fc", size);
        }
      }

      if (monumentPhase !== "locked") {
        const mon = worldToMinimap(
          SITE_LAYOUT.monument[0],
          SITE_LAYOUT.monument[1],
          bounds,
          size,
          pad,
        );
        // Keep the pylon mark inside the padded map so it doesn't sit under
        // the red shell stroke at the north edge (same red = invisible).
        const edgePad = 7 * repairScale;
        const monPx = Math.min(
          size - pad - edgePad,
          Math.max(pad + edgePad, mon.px),
        );
        const monPy = Math.min(
          size - pad - edgePad,
          Math.max(pad + edgePad + 2 * repairScale, mon.py),
        );
        const pillarW = 5.5 * repairScale;
        const pillarH = 10 * repairScale;
        const tipH = 3.2 * repairScale;
        const active = monumentPhase === "active";

        // Soft halo so the mark reads against the dark shell / red border.
        context.beginPath();
        context.arc(monPx, monPy, 7.5 * repairScale, 0, Math.PI * 2);
        context.fillStyle = active
          ? "rgba(255, 214, 102, 0.35)"
          : "rgba(251, 191, 36, 0.28)";
        context.fill();

        // Pylon body + tip (gold / cream — not Yanmar red on red border)
        context.beginPath();
        context.moveTo(monPx, monPy - pillarH * 0.55 - tipH);
        context.lineTo(monPx + pillarW * 0.55, monPy - pillarH * 0.55);
        context.lineTo(monPx + pillarW * 0.42, monPy + pillarH * 0.45);
        context.lineTo(monPx - pillarW * 0.42, monPy + pillarH * 0.45);
        context.lineTo(monPx - pillarW * 0.55, monPy - pillarH * 0.55);
        context.closePath();
        context.fillStyle = active ? "#ffe082" : "#fbbf24";
        context.fill();
        context.strokeStyle = "#fffef6";
        context.lineWidth = Math.max(1.2, 1.6 * repairScale);
        context.stroke();
        context.strokeStyle = active ? "#b71c1c" : "#92400e";
        context.lineWidth = Math.max(0.7, 0.95 * repairScale);
        context.stroke();

        // Tiny brand accent at the tip
        context.fillStyle = "#e30613";
        context.beginPath();
        context.arc(
          monPx,
          monPy - pillarH * 0.55 - tipH * 0.35,
          Math.max(1.2, 1.6 * repairScale),
          0,
          Math.PI * 2,
        );
        context.fill();
        drawMinimapMapMarker(context, monPx, monPy, "monument", "#ffe082", repairScale);
        if (showRegionLabels) {
          drawMinimapRegionLabel(context, monPx, monPy, t("world.monument"), "#ffe082", size);
        }
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
      // Chassis travel heading (not cabin swing) — "내가 가는 방향".
      // Project a nose point through the same map transform so the arrow
      // stays consistent after the north-up Z flip.
      const facing = sim.heading;
      const nose = worldToMinimap(
        sim.posX + Math.sin(facing) * 2,
        sim.posZ + Math.cos(facing) * 2,
        bounds,
        size,
        pad,
      );
      let dirX = nose.px - player.px;
      let dirY = nose.py - player.py;
      const dirLen = Math.hypot(dirX, dirY) || 1;
      dirX /= dirLen;
      dirY /= dirLen;
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

      // next frame scheduled at top of draw()
    };

    const onResize = () => {
      ctx = setupHiDpiCanvas(canvas, size)?.ctx ?? ctx;
    };

    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    // 모니터 이동·브라우저 줌으로 devicePixelRatio만 바뀔 때
    const dprQuery = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`,
    );
    const onDprChange = () => onResize();
    if (typeof dprQuery.addEventListener === "function") {
      dprQuery.addEventListener("change", onDprChange);
    } else {
      dprQuery.addListener(onDprChange);
    }
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      if (typeof dprQuery.removeEventListener === "function") {
        dprQuery.removeEventListener("change", onDprChange);
      } else {
        dprQuery.removeListener(onDprChange);
      }
    };
  }, [visible, displaySize, monumentPhase, showRegionLabels, sportsMeetUnlocked, simRef, terrainRef, tutorialStepRef, tutorialWaypointRef, worldPickupsRef, t]);

  if (!visible) return null;

  const legendItems = [
    { label: t("legend.dig"), tone: "dig" },
    { label: t("legend.dump"), tone: "dump" },
    { label: t("legend.crash"), tone: "crash" },
    { label: t("legend.hill"), tone: "hill" },
    { label: t("legend.flood"), tone: "flood" },
    { label: t("legend.repair"), tone: "repair" },
    { label: t("legend.monument"), tone: "monument" },
    ...(sportsMeetUnlocked
      ? [{ label: t("legend.sports"), tone: "sports" }]
      : []),
  ] as const;

  return (
    <div
      className={
        embedded
          ? "yanmar-minimap-hud pointer-events-none flex w-full flex-col items-stretch"
          : "yanmar-minimap-hud pointer-events-none absolute right-1.5 top-1.5 z-20 flex flex-col items-stretch"
      }
    >
      {onExpand ? (
        <button
          type="button"
          className="yanmar-minimap-expand-hit relative block w-full touch-none pointer-events-auto active:brightness-110"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            onExpand();
          }}
          aria-label="맵 크게 보기"
        >
          <canvas ref={canvasRef} className="block w-full" aria-hidden />
          <span className="yanmar-minimap-expand-badge" aria-hidden>
            <svg viewBox="0 0 16 16" width="10" height="10" fill="none">
              <path
                d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      ) : (
        <canvas ref={canvasRef} className="block" aria-label="미니맵" />
      )}
      {showLegend ? (
        <ul
          className="yanmar-minimap-legend"
          aria-label="미니맵 범례"
        >
          {legendItems.map((item) => (
            <li
              key={item.label}
              className={`yanmar-minimap-legend-item is-${item.tone}`}
            >
              <span className="yanmar-minimap-legend-mark" aria-hidden>
                <span />
              </span>
              <span className="yanmar-minimap-legend-label">{item.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
