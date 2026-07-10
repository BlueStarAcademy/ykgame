import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sources = process.argv.slice(2);
const names = ["bucket", "breaker", "grapple"];

if (sources.length !== names.length) {
  throw new Error(
    "Usage: node scripts/prepare-yanmar-attachment-icons.mjs <bucket> <breaker> <grapple>",
  );
}

const outputDir = path.resolve("public/images/yanmar/2d/attachments");
await fs.mkdir(outputDir, { recursive: true });

function isCheckerBackground(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  return (
    Math.max(red, green, blue) - Math.min(red, green, blue) <= 12 &&
    Math.min(red, green, blue) >= 210
  );
}

async function prepareIcon(source, name) {
  const { data, info } = await sharp(source)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const pixelCount = width * height;
  const background = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let queueStart = 0;
  let queueEnd = 0;

  const enqueue = (index) => {
    if (background[index] || !isCheckerBackground(data, index * 3)) return;
    background[index] = 1;
    queue[queueEnd++] = index;
  };

  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (queueStart < queueEnd) {
    const index = queue[queueStart++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }

  const rgba = Buffer.alloc(pixelCount * 4);
  for (let index = 0; index < pixelCount; index++) {
    const sourceOffset = index * 3;
    const targetOffset = index * 4;
    rgba[targetOffset] = data[sourceOffset];
    rgba[targetOffset + 1] = data[sourceOffset + 1];
    rgba[targetOffset + 2] = data[sourceOffset + 2];
    rgba[targetOffset + 3] = background[index] ? 0 : 255;
  }

  await sharp(rgba, {
    raw: { width, height, channels: 4 },
  })
    .resize(256, 256, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(outputDir, `${name}.png`));
}

await Promise.all(
  sources.map((source, index) => prepareIcon(source, names[index])),
);
