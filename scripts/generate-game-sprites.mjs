/**
 * Generates PNG sprite sheets for home cards and Phaser gameplay.
 * Run: npm run assets:generate
 */
import { createRequire } from "module";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "games");

const GAMES = [
  { id: "yanmar", color: 0xe53935, kind: "excavator" },
  { id: "johndeere", color: 0x2e7d32, kind: "tractor" },
  { id: "manitou", color: 0x8b1a1a, kind: "forklift" },
  { id: "wirtgen", color: 0x1565c0, kind: "miller" },
  { id: "voegle", color: 0x00838f, kind: "paver" },
  { id: "gehl", color: 0xf9a825, kind: "loader" },
  { id: "hamm", color: 0xef6c00, kind: "roller" },
  { id: "kleemann", color: 0x1a237e, kind: "crusher" },
];

const FRAME_W = 64;
const FRAME_H = 64;
const FRAME_COUNT = 4;

function shade(color, amount) {
  const r = Math.min(255, Math.max(0, ((color >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((color >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (color & 0xff) + amount));
  return (r << 16) | (g << 8) | b;
}

function setPixel(png, x, y, color) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = (color >> 16) & 0xff;
  png.data[idx + 1] = (color >> 8) & 0xff;
  png.data[idx + 2] = color & 0xff;
  png.data[idx + 3] = 255;
}

function fillRect(png, ox, x, y, w, h, color) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      setPixel(png, ox + px, py, color);
    }
  }
}

function fillCircle(png, ox, cx, cy, r, color) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
        setPixel(png, ox + x, y, color);
      }
    }
  }
}

function drawWheel(png, ox, cx, cy, r, color, spin) {
  fillCircle(png, ox, cx, cy, r, shade(color, -30));
  for (let i = 0; i < 4; i++) {
    const angle = ((spin + i * 90) * Math.PI) / 180;
    setPixel(
      png,
      ox + Math.round(cx + Math.cos(angle) * (r - 2)),
      Math.round(cy + Math.sin(angle) * (r - 2)),
      shade(color, -80),
    );
  }
}

function drawTrack(png, ox, x, y, w, color) {
  fillRect(png, ox, x, y, w, 6, shade(color, -40));
  fillRect(png, ox, x + 2, y + 1, w - 4, 4, shade(color, -70));
}

const DRAW = {
  excavator(png, ox, frame, color) {
    drawTrack(png, ox, 8, 48, 40, color);
    fillRect(png, ox, 14, 34, 28, 14, color);
    fillRect(png, ox, 36, 28 - frame, 8, 12, shade(color, 20));
    fillRect(png, ox, 40, 18 - frame * 1.2, 14, 6, shade(color, 30));
    fillRect(png, ox, 52, 22 - frame * 1.2, 6, 10, shade(color, -20));
    drawWheel(png, ox, 18, 50, 5, color, frame * 90);
    drawWheel(png, ox, 38, 50, 5, color, frame * 90);
  },
  tractor(png, ox, frame, color) {
    drawWheel(png, ox, 20, 48, 10, color, frame * 120);
    drawWheel(png, ox, 44, 48, 14, color, frame * 120);
    fillRect(png, ox, 16, 30, 34, 16, color);
    fillRect(png, ox, 38, 22, 12, 10, shade(color, 15));
    fillRect(png, ox, 10, 38, 40, 4, shade(color, -25));
  },
  forklift(png, ox, frame, color) {
    drawWheel(png, ox, 22, 50, 6, color, frame * 90);
    drawWheel(png, ox, 42, 50, 6, color, frame * 90);
    fillRect(png, ox, 18, 32, 30, 16, color);
    fillRect(png, ox, 44, 40 - frame, 4, 20 + frame, shade(color, -15));
    fillRect(png, ox, 38, 28 - frame, 14, 4, shade(color, 10));
    fillRect(png, ox, 36, 24 - frame, 18, 8, 0xeeeeee);
  },
  miller(png, ox, frame, color) {
    const drum = frame * 8;
    drawWheel(png, ox, 18, 50, 5, color, frame * 60);
    drawWheel(png, ox, 46, 50, 5, color, frame * 60);
    fillRect(png, ox, 12, 34, 40, 14, color);
    fillRect(png, ox, 8, 28, 48, 8, shade(color, 10));
    for (let i = 0; i < 6; i++) {
      const angle = ((drum + i * 60) * Math.PI) / 180;
      fillRect(
        png,
        ox,
        Math.round(32 + Math.cos(angle) * 8) - 2,
        Math.round(32 + Math.sin(angle) * 5) - 2,
        4,
        4,
        shade(color, -35),
      );
    }
  },
  paver(png, ox, frame, color) {
    drawWheel(png, ox, 20, 50, 5, color, frame * 70);
    drawWheel(png, ox, 40, 50, 5, color, frame * 70);
    fillRect(png, ox, 10, 34, 36, 12, color);
    fillRect(png, ox, 8, 40, 42, 6, 0x424242);
    fillRect(png, ox, 46, 36, 8, 8, shade(color, 20));
  },
  loader(png, ox, frame, color) {
    drawWheel(png, ox, 18, 50, 6, color, frame * 90);
    drawWheel(png, ox, 40, 50, 6, color, frame * 90);
    fillRect(png, ox, 14, 34, 28, 14, color);
    fillRect(png, ox, 30, 26 - frame, 18, 6, shade(color, 15));
    fillRect(png, ox, 44, 30 - frame, 8, 8, shade(color, -10));
    fillRect(png, ox, 10, 46, 36, 3, 0x8b6914);
  },
  roller(png, ox, frame, color) {
    fillRect(png, ox, 14, 30, 36, 14, color);
    drawWheel(png, ox, 32, 48, 14, color, frame * 40);
    fillRect(png, ox, 20, 24, 24, 8, shade(color, 15));
  },
  crusher(png, ox, frame, color) {
    const gap = 2 + frame * 0.5;
    fillRect(png, ox, 10, 18, 44, 36, color);
    fillRect(png, ox, 14, 22, 16, 10, shade(color, 20));
    fillRect(png, ox, 34, 22, 16, 10, shade(color, 20));
    fillRect(png, ox, 22, 32 + gap, 20, 8, shade(color, -20));
    fillRect(png, ox, 18, 48, 28, 6, 0x757575);
  },
};

for (const game of GAMES) {
  const sheet = new PNG({ width: FRAME_W * FRAME_COUNT, height: FRAME_H });

  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    DRAW[game.kind](sheet, frame * FRAME_W, frame, game.color);
  }

  const dir = join(outDir, game.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "sprite.png"), PNG.sync.write(sheet));
  console.log(`Wrote public/games/${game.id}/sprite.png`);
}
