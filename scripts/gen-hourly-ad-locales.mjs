/**
 * Generate localized hourly-ad creatives (ja/en) as SVG→PNG.
 * Korean source photos remain the default paths; ja/en get text-forward banners.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT = path.join("public", "images", "yanmar", "ads");

const ads = [
  {
    id: "sv10-sv11-launch",
    ja: {
      eyebrow: "1トン級ミニショベルの新たな基準",
      title: "SV10・SV11 発売",
      bullets: ["クラス最高仕様モデル", "サイドレバー採用", "ヤンマー3気筒エンジン搭載"],
    },
    en: {
      eyebrow: "A new standard for 1-ton mini excavators",
      title: "SV10·SV11 Launch",
      bullets: ["Top-tier specs in class", "Side lever controls", "Yanmar 3-cylinder engine"],
    },
  },
  {
    id: "parts-preorder",
    ja: {
      eyebrow: "Yanmar Parts Promo",
      title: "パーツ事前注文",
      bullets: ["ゴムトラック", "ローラー・スプロケット", "アイドラー"],
    },
    en: {
      eyebrow: "Yanmar Parts Promo",
      title: "Parts Pre-order",
      bullets: ["Rubber tracks", "Rollers & sprockets", "Idlers"],
    },
  },
  {
    id: "hourly-ad-45",
    ja: {
      eyebrow: "YK建機 × John Deere",
      title: "純正部品 20% OFF",
      bullets: ["ジョンディア純正パーツ", "期間限定プロモ", "タップして報酬"],
    },
    en: {
      eyebrow: "YK Geongi × John Deere",
      title: "Genuine Parts 20% Off",
      bullets: ["John Deere genuine parts", "Limited-time promo", "Tap for a reward"],
    },
  },
];

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function svgFor(locale, copy) {
  const bulletY = [168, 198, 228];
  const bullets = copy.bullets
    .map(
      (b, i) =>
        `<text x="48" y="${bulletY[i]}" font-family="Arial, Noto Sans JP, sans-serif" font-size="18" fill="#1f2937">· ${escapeXml(b)}</text>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="360" viewBox="0 0 720 360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f3f4f6"/>
      <stop offset="100%" stop-color="#e5e7eb"/>
    </linearGradient>
    <linearGradient id="chev" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#dc2626"/>
      <stop offset="100%" stop-color="#991b1b"/>
    </linearGradient>
  </defs>
  <rect width="720" height="360" fill="url(#bg)"/>
  <polygon points="420,0 720,0 720,360 280,360" fill="url(#chev)" opacity="0.92"/>
  <text x="48" y="64" font-family="Arial, Noto Sans JP, sans-serif" font-size="18" font-weight="700" fill="#4b5563">${escapeXml(copy.eyebrow)}</text>
  <text x="48" y="118" font-family="Arial Black, Arial, Noto Sans JP, sans-serif" font-size="${locale === "en" ? 42 : 46}" font-weight="900" fill="#111827">${escapeXml(copy.title)}</text>
  ${bullets}
  <text x="48" y="320" font-family="Arial, sans-serif" font-size="16" font-weight="800" fill="#b91c1c">YANMAR</text>
  <text x="140" y="320" font-family="Arial, Noto Sans KR, sans-serif" font-size="16" font-weight="800" fill="#111827">YK</text>
</svg>`;
}

async function write(id, locale, copy) {
  const out = path.join(OUT, `${id}.${locale}.png`);
  await sharp(Buffer.from(svgFor(locale, copy))).png().toFile(out);
  console.log("wrote", out);
}

for (const ad of ads) {
  await write(ad.id, "ja", ad.ja);
  await write(ad.id, "en", ad.en);
}
