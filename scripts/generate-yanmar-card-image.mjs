/**
 * Converts the Yanmar card source image to a transparent WebP.
 * Run: node scripts/generate-yanmar-card-image.mjs [sourcePath]
 */
import sharp from "sharp";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultSource = join(
  __dirname,
  "..",
  "public",
  "images",
  "yanmar",
  "excavator-card-source.png",
);
const output = join(__dirname, "..", "public", "images", "yanmar", "excavator-card.webp");

const source = process.argv[2] ?? defaultSource;
const HARD_BG = 42;
const SOFT_BG = 78;

const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const visited = new Uint8Array(width * height);
const queue = [];

const pix = (x, y) => y * width + x;
const at = (x, y) => pix(x, y) * channels;
const lum = (i) => Math.max(data[i], data[i + 1], data[i + 2]);
const isHardBg = (i) => lum(i) <= HARD_BG;

for (let x = 0; x < width; x++) {
  queue.push([x, 0], [x, height - 1]);
}
for (let y = 0; y < height; y++) {
  queue.push([0, y], [width - 1, y]);
}

while (queue.length) {
  const [x, y] = queue.pop();
  const p = pix(x, y);
  if (visited[p]) continue;
  visited[p] = 1;
  const i = at(x, y);
  if (!isHardBg(i)) continue;
  data[i + 3] = 0;
  if (x > 0) queue.push([x - 1, y]);
  if (x < width - 1) queue.push([x + 1, y]);
  if (y > 0) queue.push([x, y - 1]);
  if (y < height - 1) queue.push([x, y + 1]);
}

for (let y = 1; y < height - 1; y++) {
  for (let x = 1; x < width - 1; x++) {
    const i = at(x, y);
    if (data[i + 3] === 0) continue;

    let nearTransparent = false;
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (data[at(nx, ny) + 3] === 0) {
        nearTransparent = true;
        break;
      }
    }
    if (!nearTransparent) continue;

    const l = lum(i);
    if (l <= SOFT_BG) {
      data[i + 3] = Math.min(data[i + 3], Math.round(((l - HARD_BG) / (SOFT_BG - HARD_BG)) * 255));
    }
  }
}

mkdirSync(dirname(output), { recursive: true });

await sharp(data, { raw: { width, height, channels } })
  .webp({ quality: 92, alphaQuality: 100, effort: 6 })
  .toFile(output);

const meta = await sharp(output).metadata();
console.log(`Wrote ${output} (${meta.width}x${meta.height}, alpha=${meta.hasAlpha})`);
