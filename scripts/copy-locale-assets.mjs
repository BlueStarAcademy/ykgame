import fs from "node:fs";
import path from "node:path";

const files = [
  "public/images/site-legend/title.png",
  "public/images/yanmar/controls-guide.webp",
  "public/images/yanmar/ads/sv10-sv11-launch.png",
  "public/images/yanmar/ads/parts-preorder.png",
  "public/images/yanmar/ads/hourly-ad-45.png",
  "public/images/coupon-yk-parts.svg",
  "public/images/coupon-equipment-rental.svg",
  "public/images/coupon-filter-set.svg",
];

for (const f of files) {
  for (const loc of ["ja", "en"]) {
    const dir = path.dirname(f);
    const base = path.basename(f);
    const dot = base.lastIndexOf(".");
    const out = path.join(dir, `${base.slice(0, dot)}.${loc}${base.slice(dot)}`);
    if (!fs.existsSync(f)) {
      console.warn("missing source", f);
      continue;
    }
    if (!fs.existsSync(out)) {
      fs.copyFileSync(f, out);
      console.log("copied", out);
    } else {
      console.log("exists", out);
    }
  }
}
