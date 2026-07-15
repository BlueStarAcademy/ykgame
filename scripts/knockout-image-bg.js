const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

function processRGBA(data, width, height, isBg) {
  const visited = new Uint8Array(width * height);
  const queue = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (visited[i]) return;
    const p = i * 4;
    if (!isBg(data[p], data[p + 1], data[p + 2], data[p + 3])) return;
    visited[i] = 1;
    queue.push(i);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const x = i % width;
    const y = (i / width) | 0;
    const p = i * 4;
    data[p + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

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
        const ni = (y + dy) * width + (x + dx);
        if (copy[ni * 4 + 3] === 0) {
          nearT = true;
          break;
        }
      }
      if (!nearT) continue;
      if (isBg(copy[p], copy[p + 1], copy[p + 2], 255)) {
        data[p + 3] = 0;
      }
    }
  }
}

async function knockOut(file, mode) {
  const input = path.resolve(file);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.from(data);
  const { width, height } = info;

  const isBg =
    mode === "light"
      ? (r, g, b, a) => {
          if (a === 0) return true;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          return lum >= 205 && max - min <= 28;
        }
      : (r, g, b, a) => {
          if (a === 0) return true;
          return r <= 18 && g <= 18 && b <= 18;
        };

  processRGBA(rgba, width, height, isBg);

  let transparent = 0;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] === 0) transparent++;

  await sharp(rgba, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(input);

  console.log(
    "done",
    path.basename(file),
    "transparent%",
    ((100 * transparent) / (width * height)).toFixed(1),
  );
}

(async () => {
  await knockOut("public/images/yanmar/2d/enhance-core.png", "light");
  const gearDir = "public/images/yanmar/2d/gear";
  for (const f of fs.readdirSync(gearDir)) {
    if (!f.endsWith(".png") || f === "empty-slot.png") continue;
    await knockOut(path.join(gearDir, f), "dark");
  }
  const chassisDir = "public/images/yanmar/2d/chassis";
  for (const f of fs.readdirSync(chassisDir)) {
    if (!f.endsWith(".png")) continue;
    await knockOut(path.join(chassisDir, f), "light");
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
