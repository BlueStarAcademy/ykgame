import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import { PNG } from "pngjs";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const SRC = path.join(root, "public/images/equipment-cards/yanmar.webp");
const OUT = path.join(root, "public/icons");

/** Remove card background and crop to opaque content. */
async function excavatorCutout(targetSize) {
  const workSize = Math.max(targetSize * 2, 1024);
  const buf = await sharp(SRC)
    .resize(workSize, workSize, {
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
    const isLightGray =
      r > 200 && g > 200 && b > 200 && Math.abs(r - g) < 18 && Math.abs(g - b) < 18;
    const isMidGrayCard =
      r > 175 &&
      g > 175 &&
      b > 175 &&
      r < 235 &&
      Math.abs(r - g) < 12 &&
      Math.abs(g - b) < 12;
    if (isLightGray || isMidGrayCard) data[i + 3] = 0;
    else if (data[i + 3] > 0 && data[i + 3] < 40) data[i + 3] = 0;
  }

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a > 16) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const cropped = new PNG({ width: cropW, height: cropH });
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const src = ((minY + y) * width + (minX + x)) * 4;
      const dst = (y * cropW + x) * 4;
      cropped.data[dst] = data[src];
      cropped.data[dst + 1] = data[src + 1];
      cropped.data[dst + 2] = data[src + 2];
      cropped.data[dst + 3] = data[src + 3];
    }
  }

  return sharp(PNG.sync.write(cropped))
    .resize(targetSize, targetSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

function backgroundSvg(size) {
  const s = size;
  return Buffer.from(`
<svg width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="base" x1="18%" y1="0%" x2="82%" y2="100%">
      <stop offset="0%" stop-color="#2A3340"/>
      <stop offset="45%" stop-color="#1A222C"/>
      <stop offset="100%" stop-color="#0C1016"/>
    </linearGradient>
    <radialGradient id="spot" cx="46%" cy="28%" r="58%">
      <stop offset="0%" stop-color="rgba(255,196,140,0.34)"/>
      <stop offset="35%" stop-color="rgba(232,90,70,0.22)"/>
      <stop offset="70%" stop-color="rgba(120,40,36,0.1)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <linearGradient id="steel" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(255,255,255,0)"/>
      <stop offset="42%" stop-color="rgba(180,200,220,0.07)"/>
      <stop offset="58%" stop-color="rgba(255,255,255,0.11)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
    <radialGradient id="floorGlow" cx="50%" cy="100%" r="55%">
      <stop offset="0%" stop-color="rgba(255,120,80,0.16)"/>
      <stop offset="55%" stop-color="rgba(40,50,65,0.2)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <radialGradient id="vignette" cx="50%" cy="48%" r="76%">
      <stop offset="48%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.55)"/>
    </radialGradient>
  </defs>
  <rect width="${s}" height="${s}" fill="url(#base)"/>
  <rect width="${s}" height="${s}" fill="url(#spot)"/>
  <rect width="${s}" height="${s}" fill="url(#steel)"/>
  <ellipse cx="${s * 0.5}" cy="${s * 0.92}" rx="${s * 0.46}" ry="${s * 0.28}" fill="url(#floorGlow)"/>
  <!-- subtle construction grit lines -->
  <g stroke="rgba(255,255,255,0.045)" stroke-width="${Math.max(1, s * 0.003)}" fill="none">
    <line x1="${s * 0.08}" y1="${s * 0.72}" x2="${s * 0.92}" y2="${s * 0.72}"/>
    <line x1="${s * 0.14}" y1="${s * 0.78}" x2="${s * 0.86}" y2="${s * 0.78}"/>
  </g>
  <rect width="${s}" height="${s}" fill="url(#vignette)"/>
</svg>`);
}

function shadowSvg(size, excavatorSize, left, top) {
  const cx = left + excavatorSize * 0.5;
  const cy = top + excavatorSize * 0.86;
  const rx = excavatorSize * 0.4;
  const ry = excavatorSize * 0.075;
  return Buffer.from(`
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="s" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgba(0,0,0,0.72)"/>
      <stop offset="55%" stop-color="rgba(0,0,0,0.32)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
  </defs>
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#s)"/>
</svg>`);
}

async function makeIcon(size, filename) {
  // Fill most of the canvas; stay inside maskable safe zone (~80% center).
  const excavatorSize = Math.round(size * 0.86);
  const excavator = await excavatorCutout(excavatorSize);
  const left = Math.round((size - excavatorSize) / 2);
  const top = Math.round((size - excavatorSize) / 2 - size * 0.02);

  await sharp(backgroundSvg(size))
    .composite([
      { input: shadowSvg(size, excavatorSize, left, top), left: 0, top: 0 },
      { input: excavator, left, top },
    ])
    .png()
    .toFile(path.join(OUT, filename));

  console.log("wrote", filename, size);
}

fs.mkdirSync(OUT, { recursive: true });
await makeIcon(192, "icon-192.png");
await makeIcon(512, "icon-512.png");
await makeIcon(180, "apple-touch-icon.png");
console.log("done");
