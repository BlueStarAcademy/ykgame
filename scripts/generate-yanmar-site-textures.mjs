import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [groundSource, asphaltSource, backdropSource] = process.argv.slice(2);
if (!groundSource || !asphaltSource || !backdropSource) {
  throw new Error("Usage: node generate-yanmar-site-textures.mjs <ground> <asphalt> <backdrop>");
}

const outputDir = path.resolve("public/images/yanmar/2d/site");
await fs.mkdir(outputDir, { recursive: true });

async function prepareAlbedo(source, name, size) {
  await sharp(source)
    .resize(size, size, { fit: "cover" })
    .webp({ quality: 88, effort: 6 })
    .toFile(path.join(outputDir, `${name}-albedo.webp`));
}

async function deriveMaps(source, name, size) {
  const { data, info } = await sharp(source)
    .resize(size, size, { fit: "cover" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const normal = Buffer.alloc(info.width * info.height * 3);
  const roughness = Buffer.alloc(info.width * info.height);
  const at = (x, y) =>
    data[
      ((y + info.height) % info.height) * info.width +
        ((x + info.width) % info.width)
    ];
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = y * info.width + x;
      const dx = (at(x + 1, y) - at(x - 1, y)) / 255;
      const dy = (at(x, y + 1) - at(x, y - 1)) / 255;
      const nx = -dx * 2.2;
      const ny = -dy * 2.2;
      const nz = 1;
      const length = Math.hypot(nx, ny, nz);
      normal[i * 3] = Math.round((nx / length * 0.5 + 0.5) * 255);
      normal[i * 3 + 1] = Math.round((ny / length * 0.5 + 0.5) * 255);
      normal[i * 3 + 2] = Math.round((nz / length * 0.5 + 0.5) * 255);
      roughness[i] = Math.max(190, Math.min(252, 238 - Math.abs(at(x, y) - 128) * 0.16));
    }
  }
  await sharp(normal, {
    raw: { width: info.width, height: info.height, channels: 3 },
  })
    .webp({ quality: 86 })
    .toFile(path.join(outputDir, `${name}-normal.webp`));
  await sharp(roughness, {
    raw: { width: info.width, height: info.height, channels: 1 },
  })
    .webp({ quality: 82 })
    .toFile(path.join(outputDir, `${name}-roughness.webp`));
}

await prepareAlbedo(groundSource, "ground", 1024);
await deriveMaps(groundSource, "ground", 1024);
await prepareAlbedo(asphaltSource, "asphalt", 768);
await deriveMaps(asphaltSource, "asphalt", 768);
await sharp(backdropSource)
  .resize(2048, 1024, {
    fit: "cover",
    position: "center",
    withoutEnlargement: true,
  })
  .sharpen({ sigma: 0.55 })
  .webp({ lossless: true, effort: 6 })
  .toFile(path.join(outputDir, "korea-apartment-site-backdrop.webp"));
