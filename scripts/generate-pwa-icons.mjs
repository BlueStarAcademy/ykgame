/**
 * PWA 아이콘 생성 (sharp)
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "icons");

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#C62828"/>
  <text x="256" y="300" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="160" font-weight="bold">YK</text>
</svg>
`;

mkdirSync(OUT, { recursive: true });
const buf = Buffer.from(svg);

for (const size of [192, 512]) {
  await sharp(buf).resize(size, size).png().toFile(path.join(OUT, `icon-${size}.png`));
  console.log(`Wrote public/icons/icon-${size}.png`);
}
