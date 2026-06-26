import type { GameId } from "@/lib/games";

export type EquipmentKind =
  | "excavator"
  | "tractor"
  | "forklift"
  | "miller"
  | "paver"
  | "loader"
  | "roller"
  | "crusher";

export const SPRITE_FRAME_WIDTH = 64;
export const SPRITE_FRAME_HEIGHT = 64;
export const SPRITE_FRAME_COUNT = 4;

const EQUIPMENT_BY_GAME: Record<GameId, EquipmentKind> = {
  yanmar: "excavator",
  johndeere: "tractor",
  manitou: "forklift",
  wirtgen: "miller",
  voegle: "paver",
  gehl: "loader",
  hamm: "roller",
  kleemann: "crusher",
};

export function getEquipmentKind(gameId: GameId): EquipmentKind {
  return EQUIPMENT_BY_GAME[gameId];
}

export function getSpriteSheetPath(gameId: GameId): string {
  return `/games/${gameId}/sprite.png`;
}

type DrawSurface = {
  fillRect(x: number, y: number, w: number, h: number, color: number): void;
  fillCircle(x: number, y: number, r: number, color: number): void;
  fillRoundedRect?(x: number, y: number, w: number, h: number, color: number): void;
};

function shade(color: number, amount: number): number {
  const r = Math.min(255, Math.max(0, ((color >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((color >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (color & 0xff) + amount));
  return (r << 16) | (g << 8) | b;
}

function drawTrack(surface: DrawSurface, x: number, y: number, w: number, color: number) {
  surface.fillRect(x, y, w, 6, shade(color, -40));
  surface.fillRect(x + 2, y + 1, w - 4, 4, shade(color, -70));
}

function drawWheel(surface: DrawSurface, cx: number, cy: number, r: number, color: number, spin: number) {
  surface.fillCircle(cx, cy, r, shade(color, -30));
  const spoke = spin * 45;
  for (let i = 0; i < 4; i++) {
    const angle = ((spoke + i * 90) * Math.PI) / 180;
    const x = cx + Math.cos(angle) * (r - 2);
    const y = cy + Math.sin(angle) * (r - 2);
    surface.fillRect(x - 1, y - 1, 2, 2, shade(color, -80));
  }
}

function drawExcavator(surface: DrawSurface, frame: number, color: number, work: boolean) {
  const armSwing = work ? frame * 4 : frame;
  drawTrack(surface, 8, 48, 40, color);
  surface.fillRect(14, 34, 28, 14, color);
  surface.fillRect(36, 28 - armSwing, 8, 12, shade(color, 20));
  surface.fillRect(40, 18 - armSwing * 1.2, 14, 6, shade(color, 30));
  surface.fillRect(52, 22 - armSwing * 1.2, 6, 10, shade(color, -20));
  drawWheel(surface, 18, 50, 5, color, frame * 90);
  drawWheel(surface, 38, 50, 5, color, frame * 90);
}

function drawTractor(surface: DrawSurface, frame: number, color: number, work: boolean) {
  const bounce = work ? (frame % 2 === 0 ? 0 : 1) : 0;
  drawWheel(surface, 20, 48 - bounce, 10, color, frame * 120);
  drawWheel(surface, 44, 48 - bounce, 14, color, frame * 120);
  surface.fillRect(16, 30 - bounce, 34, 16, color);
  surface.fillRect(38, 22 - bounce, 12, 10, shade(color, 15));
  surface.fillRect(10, 38 - bounce, 40, 4, shade(color, -25));
}

function drawForklift(surface: DrawSurface, frame: number, color: number, work: boolean) {
  const lift = work ? frame * 3 : frame;
  drawWheel(surface, 22, 50, 6, color, frame * 90);
  drawWheel(surface, 42, 50, 6, color, frame * 90);
  surface.fillRect(18, 32, 30, 16, color);
  surface.fillRect(44, 40 - lift, 4, 20 + lift, shade(color, -15));
  surface.fillRect(38, 28 - lift, 14, 4, shade(color, 10));
  surface.fillRect(36, 24 - lift, 18, 8, 0xeeeeee);
}

function drawMiller(surface: DrawSurface, frame: number, color: number, work: boolean) {
  const drum = work ? frame * 25 : frame * 8;
  drawWheel(surface, 18, 50, 5, color, frame * 60);
  drawWheel(surface, 46, 50, 5, color, frame * 60);
  surface.fillRect(12, 34, 40, 14, color);
  surface.fillRect(8, 28, 48, 8, shade(color, 10));
  for (let i = 0; i < 6; i++) {
    const angle = ((drum + i * 60) * Math.PI) / 180;
    const cx = 32 + Math.cos(angle) * 8;
    const cy = 32 + Math.sin(angle) * 5;
    surface.fillRect(cx - 2, cy - 2, 4, 4, shade(color, -35));
  }
}

function drawPaver(surface: DrawSurface, frame: number, color: number, work: boolean) {
  const extend = work ? frame * 2 : 0;
  drawWheel(surface, 20, 50, 5, color, frame * 70);
  drawWheel(surface, 40, 50, 5, color, frame * 70);
  surface.fillRect(10, 34, 36 + extend, 12, color);
  surface.fillRect(8, 40, 42 + extend, 6, 0x424242);
  surface.fillRect(46 + extend, 36, 8, 8, shade(color, 20));
}

function drawLoader(surface: DrawSurface, frame: number, color: number, work: boolean) {
  const tilt = work ? frame * 3 : frame;
  drawWheel(surface, 18, 50, 6, color, frame * 90);
  drawWheel(surface, 40, 50, 6, color, frame * 90);
  surface.fillRect(14, 34, 28, 14, color);
  surface.fillRect(30, 26 - tilt, 18, 6, shade(color, 15));
  surface.fillRect(44, 30 - tilt, 8, 8, shade(color, -10));
  surface.fillRect(10, 46, 36, 3, 0x8b6914);
}

function drawRoller(surface: DrawSurface, frame: number, color: number, work: boolean) {
  const shake = work && frame % 2 === 1 ? 1 : 0;
  surface.fillRect(14, 30 + shake, 36, 14, color);
  drawWheel(surface, 32, 48 + shake, 14, color, frame * (work ? 180 : 40));
  surface.fillRect(20, 24 + shake, 24, 8, shade(color, 15));
}

function drawCrusher(surface: DrawSurface, frame: number, color: number, work: boolean) {
  const gap = work ? 6 - frame : 2 + frame * 0.5;
  surface.fillRect(10, 18, 44, 36, color);
  surface.fillRect(14, 22, 16, 10, shade(color, 20));
  surface.fillRect(34, 22, 16, 10, shade(color, 20));
  surface.fillRect(22, 32 + gap, 20, 8, shade(color, -20));
  surface.fillRect(18, 48, 28, 6, 0x757575);
  if (work) {
    surface.fillRect(26 + (frame % 2) * 4, 40, 4, 4, 0xbdbdbd);
  }
}

const DRAWERS: Record<
  EquipmentKind,
  (surface: DrawSurface, frame: number, color: number, work: boolean) => void
> = {
  excavator: drawExcavator,
  tractor: drawTractor,
  forklift: drawForklift,
  miller: drawMiller,
  paver: drawPaver,
  loader: drawLoader,
  roller: drawRoller,
  crusher: drawCrusher,
};

export function drawEquipmentFrame(
  surface: DrawSurface,
  gameId: GameId,
  frame: number,
  brandColor: number,
  work = false,
) {
  const kind = getEquipmentKind(gameId);
  surface.fillRect(0, 0, SPRITE_FRAME_WIDTH, SPRITE_FRAME_HEIGHT, 0x00000000);
  DRAWERS[kind](surface, frame % SPRITE_FRAME_COUNT, brandColor, work);
}

export function createCanvasDrawSurface(
  ctx: CanvasRenderingContext2D,
  offsetX = 0,
  offsetY = 0,
): DrawSurface {
  const toCss = (color: number) => {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    const a = color > 0xffffff ? 1 : ((color >>> 24) & 0xff) / 255 || 1;
    return a < 1 ? `rgba(${r},${g},${b},${a})` : `rgb(${r},${g},${b})`;
  };

  return {
    fillRect(x, y, w, h, color) {
      if (color === 0) return;
      ctx.fillStyle = toCss(color);
      ctx.fillRect(offsetX + x, offsetY + y, w, h);
    },
    fillCircle(x, y, r, color) {
      ctx.fillStyle = toCss(color);
      ctx.beginPath();
      ctx.arc(offsetX + x, offsetY + y, r, 0, Math.PI * 2);
      ctx.fill();
    },
  };
}
