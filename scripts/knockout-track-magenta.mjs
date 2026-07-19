/**
 * Chroma-key lime-green backgrounds on track gear icons + defringe.
 * Green screen avoids purple/magenta fringe from prior magenta keys.
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

function isGreenKey(r, g, b, a) {
  if (a === 0) return true;
  // Pure / soft lime #00FF00 and anti-aliased greens
  if (g >= 140 && g > r + 40 && g > b + 40) return true;
  if (g >= 100 && g >= r * 1.35 && g >= b * 1.35 && g - Math.max(r, b) >= 30) {
    return true;
  }
  // Darker green spill
  if (g >= 70 && r <= 90 && b <= 90 && g > r + 25 && g > b + 25) return true;
  return false;
}

function isGreenFringe(r, g, b, a) {
  if (a < 50) return true;
  if (a < 200 && g > r + 15 && g > b + 15 && g >= 60) return true;
  if (g >= 80 && g > r + 20 && g > b + 20) return true;
  return false;
}

function nearTransparent(data, width, height, x, y) {
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
    if (data[(ny * width + nx) * 4 + 3] < 40) return true;
  }
  return false;
}

function neighborColor(data, width, height, x, y) {
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const p = (ny * width + nx) * 4;
      if (data[p + 3] < 180) continue;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      if (isGreenKey(r, g, b, 255)) continue;
      sr += r;
      sg += g;
      sb += b;
      n++;
    }
  }
  if (!n) return null;
  return { r: (sr / n) | 0, g: (sg / n) | 0, b: (sb / n) | 0 };
}

function processRGBA(data, width, height) {
  for (let i = 0; i < width * height; i++) {
    const p = i * 4;
    if (isGreenKey(data[p], data[p + 1], data[p + 2], data[p + 3])) {
      data[p + 3] = 0;
    }
  }

  const copy = Buffer.from(data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      const a = copy[p + 3];
      if (a === 0) continue;
      const r = copy[p];
      const g = copy[p + 1];
      const b = copy[p + 2];
      const onEdge = nearTransparent(copy, width, height, x, y);
      if (!onEdge) continue;

      if (isGreenFringe(r, g, b, a)) {
        data[p + 3] = 0;
        continue;
      }

      // Kill any leftover magenta/purple fringe from older gens mixed in
      const mag = r + b - 2 * g;
      if (
        mag >= 50 &&
        r >= 70 &&
        b >= 70 &&
        Math.abs(r - b) <= 80 &&
        g < Math.min(r, b) * 0.9
      ) {
        data[p + 3] = 0;
        continue;
      }

      if (g > r + 10 && g > b + 10 && g >= 50) {
        const nb = neighborColor(copy, width, height, x, y);
        if (nb) {
          data[p] = nb.r;
          data[p + 1] = nb.g;
          data[p + 2] = nb.b;
        } else {
          const lum = (0.3 * r + 0.59 * g + 0.11 * b) | 0;
          data[p] = lum;
          data[p + 1] = lum;
          data[p + 2] = lum;
        }
      }
    }
  }
}

async function processFile(name) {
  const src = path.join(assetsDir, name);
  if (!fs.existsSync(src)) throw new Error(`Missing source: ${src}`);

  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.from(data);
  processRGBA(rgba, info.width, info.height);

  const resized = await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.from(resized.data);
  processRGBA(out, resized.info.width, resized.info.height);

  await sharp(out, {
    raw: {
      width: resized.info.width,
      height: resized.info.height,
      channels: 4,
    },
  })
    .png()
    .toFile(path.join(gearDir, name));

  console.log("done", name);
}

for (const f of FILES) {
  await processFile(f);
}
fs.copyFileSync(
  path.join(gearDir, "track-normal.png"),
  path.join(gearDir, "track.png"),
);
console.log("legacy track.png");
