/**
 * Renders consistent 512×512 chassis portrait PNGs from visual profiles.
 * Same frame size for every model — differences are cab / bulk / track type only.
 *
 * Usage: node scripts/render-chassis-portraits.mjs
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outDir = path.join(projectRoot, "public/images/yanmar/2d/chassis/models");
const OUT_SIZE = 512;

/** Mirrors chassisVisualConfig profiles (keep in sync). */
const PROFILES = [
  { id: "SV08_1C", cabStyle: "open", bodyBulk: 0.9, trackWidth: 0.92, trackType: "rubber", rollerCount: 2 },
  { id: "SV10", cabStyle: "open", bodyBulk: 0.93, trackWidth: 0.94, trackType: "rubber", rollerCount: 2 },
  { id: "SV11", cabStyle: "rollbar", rollbarVariant: "single", bodyBulk: 0.95, trackWidth: 0.96, trackType: "rubber", rollerCount: 3 },
  { id: "ViO12_2A", cabStyle: "rollbar", rollbarVariant: "arch", bodyBulk: 0.97, trackWidth: 0.97, trackType: "rubber", rollerCount: 3 },
  { id: "ViO17_1", cabStyle: "canopy", canopyVariant: "twoPost", bodyBulk: 1, trackWidth: 1, trackType: "rubber", rollerCount: 3 },
  { id: "ViO20_6", cabStyle: "canopy", canopyVariant: "twoPost", bodyBulk: 1.04, trackWidth: 1.03, trackType: "rubber", rollerCount: 3 },
  { id: "ViO23_6", cabStyle: "canopy", canopyVariant: "twoPost", bodyBulk: 1.06, trackWidth: 1.05, trackType: "rubber", rollerCount: 3 },
  { id: "ViO25_6A", cabStyle: "canopy", canopyVariant: "fourPost", bodyBulk: 1.08, trackWidth: 1.06, trackType: "rubber", rollerCount: 4 },
  { id: "ViO35_74", cabStyle: "canopy", canopyVariant: "fourPost", bodyBulk: 1.12, trackWidth: 1.08, trackType: "rubber", rollerCount: 4 },
  { id: "ViO35_7A_CJR", cabStyle: "enclosed", bodyBulk: 1.14, trackWidth: 1.08, trackType: "rubber", rollerCount: 4 },
  { id: "ViO55_6A", cabStyle: "enclosed", bodyBulk: 1.2, trackWidth: 1.12, trackType: "steel", rollerCount: 4 },
  { id: "ViO80_7", cabStyle: "enclosed", bodyBulk: 1.26, trackWidth: 1.16, trackType: "steel", rollerCount: 5 },
  { id: "SV100_7", cabStyle: "enclosed", bodyBulk: 1.32, trackWidth: 1.2, trackType: "steel", rollerCount: 5 },
];

const RED = "#e2231a";
const RED_BRIGHT = "#ff3b2f";
const RED_DARK = "#8f1111";
const FRAME = "#141a20";
const FRAME_LIGHT = "#2b353e";
const RUBBER = "#0a0e12";
const RUBBER_HI = "#1d282f";
const STEEL = "#626b72";
const STEEL_BRIGHT = "#788894";
const GLASS = "#17323a";
const SEAT = "#303840";
const OUTLINE = "#080a0c";

function buildSvg(p) {
  const bulk = p.bodyBulk;
  const tw = p.trackWidth;
  // Fixed machine footprint in viewBox — never shrink whole machine for small models
  const vb = 200;
  const cx = 100;
  const cy = 112;

  const trackH = 28 * tw;
  const trackW = 118 * (0.96 + (tw - 1) * 0.4);
  const trackY = cy + 28;
  const trackX = cx - trackW / 2 - 8;

  const hoodW = 72 * (0.88 + bulk * 0.12);
  const hoodH = 34 * (0.9 + bulk * 0.1);
  const hoodX = cx - 18;
  const hoodY = cy - 18;

  const boomThick = 10 + (bulk - 1) * 8;
  const isSteel = p.trackType === "steel";
  const rollerN = p.rollerCount;

  // Track treads
  let treads = "";
  const treadCount = isSteel ? 14 : 12;
  for (let i = 0; i < treadCount; i++) {
    const t = i / treadCount;
    const x = trackX + 6 + t * (trackW - 12);
    const fill = isSteel ? STEEL : RUBBER_HI;
    treads += `<rect x="${x.toFixed(1)}" y="${(trackY + trackH - 7).toFixed(1)}" width="${isSteel ? 6 : 7}" height="5" rx="1" fill="${fill}" stroke="${OUTLINE}" stroke-width="0.6"/>`;
  }

  // Rollers / wheels
  let wheels = "";
  const idlerR = isSteel ? 9 : 10;
  const sprocketR = isSteel ? 10 : 7.5;
  const idlerCx = trackX + trackW - 14;
  const sprocketCx = trackX + 14;
  const wheelCy = trackY + trackH / 2;

  wheels += `<circle cx="${idlerCx}" cy="${wheelCy}" r="${idlerR}" fill="${FRAME}" stroke="${OUTLINE}" stroke-width="1.2"/>`;
  wheels += `<circle cx="${idlerCx}" cy="${wheelCy}" r="${idlerR * 0.4}" fill="${FRAME_LIGHT}"/>`;
  if (!isSteel) {
    wheels += `<circle cx="${idlerCx}" cy="${wheelCy}" r="${idlerR * 0.85}" fill="none" stroke="${RUBBER_HI}" stroke-width="2.5"/>`;
  } else {
    wheels += `<circle cx="${idlerCx}" cy="${wheelCy}" r="${idlerR * 0.72}" fill="none" stroke="${STEEL_BRIGHT}" stroke-width="2"/>`;
  }

  wheels += `<circle cx="${sprocketCx}" cy="${wheelCy}" r="${sprocketR}" fill="${isSteel ? STEEL : FRAME}" stroke="${OUTLINE}" stroke-width="1.2"/>`;
  wheels += `<circle cx="${sprocketCx}" cy="${wheelCy}" r="${sprocketR * 0.35}" fill="${FRAME_LIGHT}"/>`;
  const teeth = isSteel ? 8 : 6;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const tr = sprocketR * 0.78;
    const tx = sprocketCx + Math.cos(a) * tr;
    const ty = wheelCy + Math.sin(a) * tr;
    wheels += `<rect x="${(tx - 1.5).toFixed(1)}" y="${(ty - 2).toFixed(1)}" width="3" height="${isSteel ? 4.5 : 3.5}" rx="0.5" fill="${STEEL_BRIGHT}" transform="rotate(${((a * 180) / Math.PI).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)})"/>`;
  }

  for (let i = 0; i < rollerN; i++) {
    const t = rollerN === 1 ? 0.5 : i / (rollerN - 1);
    const rx = sprocketCx + 16 + t * (idlerCx - sprocketCx - 32);
    const rr = 5.5;
    wheels += `<circle cx="${rx.toFixed(1)}" cy="${(wheelCy + 2).toFixed(1)}" r="${rr}" fill="${FRAME}" stroke="${OUTLINE}" stroke-width="1"/>`;
    wheels += `<circle cx="${rx.toFixed(1)}" cy="${(wheelCy + 2).toFixed(1)}" r="${rr * 0.4}" fill="${FRAME_LIGHT}"/>`;
  }

  // Track frame
  const trackFill = isSteel ? FRAME : RUBBER;
  const track = `
    <rect x="${trackX}" y="${trackY}" width="${trackW}" height="${trackH}" rx="${isSteel ? 8 : 13}" fill="${trackFill}" stroke="${OUTLINE}" stroke-width="1.8"/>
    <rect x="${trackX + 10}" y="${trackY + 6}" width="${trackW - 20}" height="${trackH * 0.35}" rx="4" fill="${FRAME_LIGHT}" opacity="0.85"/>
    ${treads}
    ${wheels}
  `;

  // Undercarriage bridge
  const bridge = `<rect x="${(cx - 40).toFixed(1)}" y="${(trackY - 6).toFixed(1)}" width="80" height="12" rx="4" fill="${FRAME_LIGHT}" stroke="${OUTLINE}" stroke-width="1"/>`;

  // Counterweight
  const cwW = 22 * bulk;
  const cwH = 28 * Math.min(1.2, bulk);
  const cw = `<rect x="${(hoodX - cwW - 4).toFixed(1)}" y="${(hoodY - 2).toFixed(1)}" width="${cwW.toFixed(1)}" height="${cwH.toFixed(1)}" rx="5" fill="${RED}" stroke="${OUTLINE}" stroke-width="1.4"/>
    <rect x="${(hoodX - cwW + 2).toFixed(1)}" y="${(hoodY + 2).toFixed(1)}" width="${(cwW * 0.45).toFixed(1)}" height="${(cwH * 0.35).toFixed(1)}" rx="3" fill="${RED_DARK}"/>`;

  // Hood / body
  const hood = `
    <rect x="${hoodX}" y="${hoodY}" width="${hoodW}" height="${hoodH}" rx="8" fill="${RED}" stroke="${OUTLINE}" stroke-width="1.6"/>
    <rect x="${(hoodX + hoodW * 0.55).toFixed(1)}" y="${(hoodY - 8).toFixed(1)}" width="${(hoodW * 0.42).toFixed(1)}" height="${(hoodH * 0.85).toFixed(1)}" rx="7" fill="${RED_BRIGHT}" stroke="${OUTLINE}" stroke-width="1.2"/>
    <rect x="${(hoodX + 8).toFixed(1)}" y="${(hoodY + 6).toFixed(1)}" width="${(hoodW * 0.4).toFixed(1)}" height="4" rx="1" fill="#ff7567" opacity="0.7"/>
  `;

  // Seat
  const seat = `
    <rect x="${(hoodX + 8).toFixed(1)}" y="${(hoodY - 22).toFixed(1)}" width="18" height="14" rx="3" fill="${SEAT}" stroke="${OUTLINE}" stroke-width="1"/>
    <rect x="${(hoodX + 6).toFixed(1)}" y="${(hoodY - 10).toFixed(1)}" width="22" height="8" rx="2" fill="${FRAME_LIGHT}"/>
  `;

  // Cab silhouette
  let cab = "";
  const cabBaseX = hoodX + 4;
  const cabBaseY = hoodY - 42;
  if (p.cabStyle === "rollbar") {
    if (p.rollbarVariant === "arch") {
      cab = `
        <path d="M ${cabBaseX + 4} ${hoodY - 2} L ${cabBaseX + 4} ${cabBaseY + 10}
          A 16 16 0 0 1 ${cabBaseX + 36} ${cabBaseY + 10} L ${cabBaseX + 36} ${hoodY - 2}"
          fill="none" stroke="${FRAME}" stroke-width="4.5" stroke-linecap="round"/>
      `;
    } else {
      cab = `
        <rect x="${cabBaseX + 16}" y="${cabBaseY + 4}" width="5" height="40" rx="2" fill="${FRAME}" stroke="${OUTLINE}" stroke-width="0.8"/>
        <rect x="${cabBaseX + 10}" y="${cabBaseY + 2}" width="18" height="5" rx="2" fill="${FRAME}"/>
      `;
    }
  } else if (p.cabStyle === "canopy") {
    const four = p.canopyVariant === "fourPost";
    // Side view: rear + front posts on the near side
    const postXs = four ? [0, 16, 34] : [2, 30];
    cab = postXs
      .map(
        (dx) =>
          `<rect x="${cabBaseX + dx}" y="${cabBaseY + 8}" width="4.5" height="36" rx="1.5" fill="${FRAME}" stroke="${OUTLINE}" stroke-width="0.6"/>`,
      )
      .join("");
    const roofW = four ? 48 : 40;
    cab += `<rect x="${cabBaseX - 4}" y="${cabBaseY + 4}" width="${roofW}" height="7" rx="2" fill="${FRAME}" stroke="${OUTLINE}" stroke-width="1"/>`;
    cab += `<rect x="${cabBaseX - 6}" y="${cabBaseY - 2}" width="${roofW + 4}" height="8" rx="2.5" fill="#1a1f24" stroke="${OUTLINE}" stroke-width="1"/>`;
    if (four) {
      cab += `<rect x="${cabBaseX - 2}" y="${cabBaseY + 22}" width="${roofW - 4}" height="3.5" rx="1" fill="${FRAME}"/>`;
    }
  } else if (p.cabStyle === "enclosed") {
    cab = `
      <rect x="${cabBaseX - 2}" y="${cabBaseY}" width="50" height="46" rx="4" fill="${FRAME}" stroke="${OUTLINE}" stroke-width="1.4"/>
      <rect x="${cabBaseX + 3}" y="${cabBaseY + 8}" width="40" height="30" rx="2" fill="${GLASS}" opacity="0.9"/>
      <rect x="${cabBaseX - 4}" y="${cabBaseY - 8}" width="54" height="11" rx="3" fill="${RED}" stroke="${OUTLINE}" stroke-width="1.2"/>
      <rect x="${cabBaseX + 40}" y="${cabBaseY + 10}" width="3.5" height="26" rx="1" fill="${FRAME_LIGHT}"/>
    `;
  }

  // Boom / arm / bucket — kept inside fixed frame
  const boomRootX = hoodX + hoodW * 0.78;
  const boomRootY = hoodY + 6;
  const boom = `
    <g stroke-linejoin="round" stroke-linecap="round">
      <path d="M ${boomRootX} ${boomRootY}
        L ${boomRootX + 34} ${boomRootY - 40}
        L ${boomRootX + 58} ${boomRootY - 18}"
        fill="none" stroke="${OUTLINE}" stroke-width="${boomThick + 2}"/>
      <path d="M ${boomRootX} ${boomRootY}
        L ${boomRootX + 34} ${boomRootY - 40}
        L ${boomRootX + 58} ${boomRootY - 18}"
        fill="none" stroke="${RED}" stroke-width="${boomThick}"/>
      <path d="M ${boomRootX + 54} ${boomRootY - 16}
        L ${boomRootX + 66} ${boomRootY + 14}
        L ${boomRootX + 48} ${boomRootY + 18} Z"
        fill="${FRAME}" stroke="${OUTLINE}" stroke-width="1.2"/>
    </g>
  `;

  // Dozer blade hint
  const blade = `<rect x="${(trackX + trackW - 8).toFixed(1)}" y="${(trackY + 4).toFixed(1)}" width="10" height="${(trackH - 6).toFixed(1)}" rx="2" fill="${STEEL_BRIGHT}" stroke="${OUTLINE}" stroke-width="1"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_SIZE}" height="${OUT_SIZE}" viewBox="0 0 ${vb} ${vb}">
  <g>
    ${track}
    ${bridge}
    ${blade}
    ${cw}
    ${hood}
    ${seat}
    ${cab}
    ${boom}
  </g>
</svg>`;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`Rendering ${PROFILES.length} chassis portraits → ${outDir}`);

  for (const p of PROFILES) {
    const svg = buildSvg(p);
    const dest = path.join(outDir, `${p.id}.png`);
    await sharp(Buffer.from(svg))
      .resize(OUT_SIZE, OUT_SIZE, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toFile(dest);
    const st = fs.statSync(dest);
    console.log(`  wrote ${p.id}.png (${st.size} bytes) [${p.cabStyle}/${p.trackType}]`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
