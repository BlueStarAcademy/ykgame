/**
 * Turn Soosan SB30E side-type breaker renders into gear icons.
 *
 * The renders arrive on an opaque checkerboard, so the flat light-neutral
 * background is flood-filled from the borders and replaced with alpha before
 * the art is trimmed and fitted to the 512px gear-icon frame.
 *
 * Usage: node scripts/gen-breaker-icons.mjs [srcDir]
 * srcDir must contain breaker-side-{normal,enhanced,precision,master}-gen.png
 */
import sharp from "sharp";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR =
  process.argv[2] ??
  join(
    process.env.USERPROFILE ?? process.env.HOME ?? "",
    ".cursor/projects/c-project-ykgame/assets",
  );
const GEAR_DIR = join(__dirname, "../public/images/yanmar/2d/gear");
const ATTACH_DIR = join(__dirname, "../public/images/yanmar/2d/attachments");

const GRADES = ["normal", "enhanced", "precision", "master"];

const ICON_SIZE = 512;
/** Keeps a small breathing margin like the other gear icons. */
const ICON_MARGIN = 10;

/** Checkerboard tiles are near-white neutrals; art never is at the silhouette. */
function isBackgroundColor(r, g, b) {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min >= 234 && max - min <= 8;
}

function buildAlphaMask(data, width, height, channels) {
  const total = width * height;
  const isBg = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const push = (idx) => {
    if (isBg[idx]) return;
    const o = idx * channels;
    if (!isBackgroundColor(data[o], data[o + 1], data[o + 2])) return;
    isBg[idx] = 1;
    queue[tail++] = idx;
  };

  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % width;
    const y = (idx - x) / width;
    if (x > 0) push(idx - 1);
    if (x < width - 1) push(idx + 1);
    if (y > 0) push(idx - width);
    if (y < height - 1) push(idx + width);
  }

  // Erode one pixel so the light checkerboard fringe does not survive as a halo.
  const alpha = new Uint8Array(total);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (isBg[idx]) continue;
      const touchesBg =
        (x > 0 && isBg[idx - 1]) ||
        (x < width - 1 && isBg[idx + 1]) ||
        (y > 0 && isBg[idx - width]) ||
        (y < height - 1 && isBg[idx + width]);
      alpha[idx] = touchesBg ? 0 : 255;
    }
  }
  return alpha;
}

async function cutout(srcPath) {
  const { data, info } = await sharp(srcPath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const alpha = buildAlphaMask(data, width, height, channels);

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * channels;
    const d = i * 4;
    rgba[d] = data[s];
    rgba[d + 1] = data[s + 1];
    rgba[d + 2] = data[s + 2];
    rgba[d + 3] = alpha[i];
  }

  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 0 })
    .png()
    .toBuffer();
}

async function writeIcon(cutoutPng, outPath, size) {
  const margin = Math.round((ICON_MARGIN * size) / ICON_SIZE);
  const inner = size - margin * 2;
  const png = await sharp(cutoutPng)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: margin,
      bottom: margin,
      left: margin,
      right: margin,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(outPath, png);
  console.log("wrote", outPath, png.length, "bytes");
}

let normalCutout = null;
for (const grade of GRADES) {
  const cut = await cutout(join(SRC_DIR, `breaker-side-${grade}-gen.png`));
  if (grade === "normal") normalCutout = cut;
  await writeIcon(cut, join(GEAR_DIR, `breaker-${grade}.png`), ICON_SIZE);
}

// Generic breaker art: HUD attachment picker + legacy gear fallback.
await writeIcon(normalCutout, join(ATTACH_DIR, "breaker.png"), 256);
await writeIcon(normalCutout, join(GEAR_DIR, "breaker.png"), ICON_SIZE);
console.log("done");
