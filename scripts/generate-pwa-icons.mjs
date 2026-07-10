import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import { PNG } from "pngjs";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const SRC = path.join(root, "public/images/equipment-cards/yanmar.webp");
const OUT = path.join(root, "public/icons");

/** Remove light-gray card background so excavator sits on icon red. */
async function excavatorCutout(size) {
  const buf = await sharp(SRC)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  const png = PNG.sync.read(buf);
  const { data, width, height } = png;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Light gray / near-white card background
    const isLightGray =
      r > 200 && g > 200 && b > 200 && Math.abs(r - g) < 18 && Math.abs(g - b) < 18;
    const isMidGrayCard =
      r > 175 &&
      g > 175 &&
      b > 175 &&
      r < 235 &&
      Math.abs(r - g) < 12 &&
      Math.abs(g - b) < 12;
    if (isLightGray || isMidGrayCard) {
      data[i + 3] = 0;
    }
  }

  // Soft edge cleanup: kill near-transparent fringe
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0 && data[i + 3] < 40) data[i + 3] = 0;
  }

  return PNG.sync.write(png);
}

async function makeIcon(size, filename) {
  const excavatorSize = Math.round(size * 0.78);
  const excavator = await excavatorCutout(excavatorSize);

  const bgSvg = Buffer.from(`
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#EF5350"/>
      <stop offset="45%" stop-color="#C62828"/>
      <stop offset="100%" stop-color="#8E0000"/>
    </linearGradient>
    <radialGradient id="v" cx="42%" cy="32%" r="75%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.28)"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <rect width="${size}" height="${size}" fill="url(#v)"/>
</svg>`);

  const fontSize = Math.round(size * 0.145);
  const labelY = size - Math.round(size * 0.07);
  const textSvg = Buffer.from(`
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${Math.max(1, size * 0.008)}" stdDeviation="${Math.max(1, size * 0.012)}" flood-color="#000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <text
    x="50%"
    y="${labelY}"
    text-anchor="middle"
    font-family="Arial Black, Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="900"
    fill="#FFFFFF"
    letter-spacing="${Math.round(size * 0.008)}"
    filter="url(#shadow)"
  >YK게임</text>
</svg>`);

  const left = Math.round((size - excavatorSize) / 2);
  const top = Math.round(size * 0.02);

  await sharp(bgSvg)
    .composite([
      { input: excavator, left, top },
      { input: textSvg, left: 0, top: 0 },
    ])
    .png()
    .toFile(path.join(OUT, filename));

  console.log("wrote", filename, size);
}

await makeIcon(192, "icon-192.png");
await makeIcon(512, "icon-512.png");
await makeIcon(180, "apple-touch-icon.png");
console.log("done");
