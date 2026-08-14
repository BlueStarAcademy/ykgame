import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ko = JSON.parse(readFileSync("messages/ko.json", "utf8"));
const ja = JSON.parse(readFileSync("messages/ja.json", "utf8"));
const en = JSON.parse(readFileSync("messages/en.json", "utf8"));

function keySet(obj, prefix = "") {
  const keys = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const child of keySet(v, path)) keys.add(child);
    } else {
      keys.add(path);
    }
  }
  return keys;
}

function localizedAsset(path, locale = "ko") {
  if (locale === "ko") return path;
  const qIndex = path.indexOf("?");
  const base = qIndex >= 0 ? path.slice(0, qIndex) : path;
  const query = qIndex >= 0 ? path.slice(qIndex) : "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return `${base}.${locale}${query}`;
  return `${base.slice(0, dot)}.${locale}${base.slice(dot)}${query}`;
}

const koKeys = keySet(ko);
const jaKeys = keySet(ja);
const enKeys = keySet(en);

for (const key of koKeys) {
  assert.ok(jaKeys.has(key), `ja missing key: ${key}`);
  assert.ok(enKeys.has(key), `en missing key: ${key}`);
}
assert.equal(jaKeys.size, koKeys.size, "ja has extra keys");
assert.equal(enKeys.size, koKeys.size, "en has extra keys");

assert.equal(localizedAsset("/images/a.webp", "ko"), "/images/a.webp");
assert.equal(localizedAsset("/images/a.webp", "ja"), "/images/a.ja.webp");
assert.equal(localizedAsset("/images/a.webp", "en"), "/images/a.en.webp");
assert.equal(localizedAsset("/images/a.webp?v=1", "ja"), "/images/a.ja.webp?v=1");

const requiredAssets = [
  "public/images/site-legend/title.ja.png",
  "public/images/site-legend/title.en.png",
  "public/images/yanmar/controls-guide.ja.webp",
  "public/images/yanmar/controls-guide.en.webp",
  "public/images/yanmar/ads/sv10-sv11-launch.ja.png",
  "public/images/yanmar/ads/parts-preorder.en.png",
  "public/images/coupon-yk-parts.ja.svg",
  "public/images/coupon-filter-set.en.svg",
];
for (const asset of requiredAssets) {
  assert.ok(
    readFileSync(asset).length > 0,
    `missing or empty asset: ${asset}`,
  );
}

console.log(`i18n smoke OK — ${koKeys.size} keys × 3 locales, assets present`);
