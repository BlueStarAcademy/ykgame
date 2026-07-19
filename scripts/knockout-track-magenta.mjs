/**
 * Chroma-key magenta backgrounds on track gear icons only.
 * Does NOT key near-black (dark tread stays opaque).
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const assetsDir = path.join(
  process.env.USERPROFILE ?? "",
  ".cursor/projects/c-project-ykgame/assets",
);
const gearDir = path.join(root, "public/images/yanmar/2d/gear");

const FILES = [
  "track-normal.png",
  "track-enhanced.png",
  "track-precision.png",
  "track-master.png",
];

/** Bright magenta / pink key — not holographic cyan-magenta facets. */
function isMagenta(r, g, b, a) {
  if (a === 0) return true;
  // High R+B, low G (classic #FF00FF and anti-aliased fringe)
  if (r >= 140 && b >= 120 && g <= 100 && r + b - 2 * g >= 160) return true;
  // Soft fringe: mostly magenta with some bleed
  if (r >= 180 && b >= 150 && g <= 120 && Math.abs(r - b) <= 90) return true;
  return false;
}

function processRGBA(data, width, height) {
  // Punch ALL magenta (including enclosed gaps inside the track loop).
  // Dark tread is never keyed — only chroma magenta.
  for (let i = 0; i < width * height; i++) {
    const p = i * 4;
    if (isMagenta(data[p], data[p + 1], data[p + 2], data[p + 3])) {
      data[p + 3] = 0;
    }
  }

  // Soften 1px magenta fringe next to transparent
  const copy = Buffer.from(data);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const p = i * 4;
      if (copy[p + 3] === 0) continue;
      let nearT = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (copy[((y + dy) * width + (x + dx)) * 4 + 3] === 0) {
          nearT = true;
          break;
        }
      }
      if (!nearT) continue;
      const r = copy[p];
      const g = copy[p + 1];
      const b = copy[p + 2];
      // Mild fringe: high R+B relative to G near transparency
      if (r >= 140 && b >= 120 && g <= 130 && r + b > 2.2 * g + 80) {
        data[p + 3] = 0;
      }
    }
  }
}

async function processFile(name) {
  const src = path.join(assetsDir, name);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing source: ${src}`);
  }
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.from(data);
  processRGBA(rgba, info.width, info.height);

  let transparent = 0;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] === 0) transparent++;

  const dest = path.join(gearDir, name);
  await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(dest);

  console.log(
    "done",
    name,
    "transparent%",
    ((100 * transparent) / (info.width * info.height)).toFixed(1),
  );
}

for (const f of FILES) {
  await processFile(f);
}
fs.copyFileSync(
  path.join(gearDir, "track-normal.png"),
  path.join(gearDir, "track.png"),
);
console.log("legacy track.png");
