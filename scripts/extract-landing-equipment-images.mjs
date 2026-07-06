/**
 * Crops the YK건기 promo grid into per-equipment images for the landing page.
 * Run: node scripts/extract-landing-equipment-images.mjs
 */
import sharp from "sharp";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const SOURCE = join(root, "public/images/landing/promo-source.jpg");
const OUT_DIR = join(root, "public/images/landing/equipment");

/** Manual regions tuned for 1024×724 promo (2 cols × 4 rows) */
const REGIONS = {
  yanmar: { left: 42, top: 160, width: 230, height: 118 },
  johndeere: { left: 520, top: 160, width: 230, height: 118 },
  manitou: { left: 42, top: 286, width: 230, height: 118 },
  wirtgen: { left: 520, top: 286, width: 230, height: 118 },
  voegle: { left: 42, top: 412, width: 230, height: 118 },
  gehl: { left: 520, top: 412, width: 230, height: 118 },
  hamm: { left: 42, top: 538, width: 230, height: 118 },
  kleemann: { left: 520, top: 538, width: 230, height: 118 },
};

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const [id, region] of Object.entries(REGIONS)) {
    const outPath = join(OUT_DIR, `${id}.jpg`);
    await sharp(SOURCE)
      .extract(region)
      .jpeg({ quality: 90, mozjpeg: true })
      .toFile(outPath);
    console.log(`✓ ${id} → ${region.width}x${region.height}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
