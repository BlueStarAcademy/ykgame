/**
 * Generate localized Site Legend title PNGs (ja/en) via SVG → sharp.
 * Korean source remains public/images/site-legend/title.png
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT_DIR = path.join("public", "images", "site-legend");

const titles = {
  ja: "現場伝説",
  en: "SITE LEGEND",
};

async function render(locale, text) {
  const fontSize = locale === "en" ? 72 : 88;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="220" viewBox="0 0 900 220">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff8e7"/>
      <stop offset="55%" stop-color="#f5d76e"/>
      <stop offset="100%" stop-color="#c9a227"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect width="900" height="220" fill="transparent"/>
  <text x="450" y="130" text-anchor="middle" font-family="Arial Black, Hiragino Sans, Noto Sans JP, sans-serif"
    font-size="${fontSize}" font-weight="900" fill="url(#g)" filter="url(#shadow)"
    stroke="#5c3d0a" stroke-width="3" paint-order="stroke">${text}</text>
</svg>`;

  const out = path.join(OUT_DIR, `title.${locale}.png`);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("wrote", out);
}

await Promise.all([render("ja", titles.ja), render("en", titles.en)]);
