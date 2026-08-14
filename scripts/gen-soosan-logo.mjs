import sharp from "sharp";
import { writeFileSync } from "fs";

/**
 * SOOSAN lockup matching the supplied brand mark:
 * twin slanted diamonds + bold italic SOOSAN + SB20.
 */
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="240" viewBox="0 0 1400 240">
  <g fill="#111111" transform="skewX(-12)">
    <!-- Twin interlocking slanted diamonds -->
    <g transform="translate(70,24)">
      <polygon points="24,4 138,4 102,108 -12,108"/>
      <polygon points="70,118 184,118 148,222 34,222"/>
    </g>
    <text
      x="280"
      y="168"
      font-family="Arial Black, Impact, Arial, sans-serif"
      font-size="148"
      font-weight="900"
      letter-spacing="-6"
    >SOOSAN</text>
    <text
      x="980"
      y="168"
      font-family="Arial Black, Impact, Arial, sans-serif"
      font-size="122"
      font-weight="900"
      letter-spacing="-3"
    >SB20</text>
  </g>
</svg>`;

const out = "public/images/yanmar/2d/attachments/soosan-sb20-logo.png";
const png = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync(out, png);
console.log("wrote", out, png.length, "bytes");
