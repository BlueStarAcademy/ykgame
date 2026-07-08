import sharp from "sharp";

const source = "public/images/yanmar/cockpit-game-controls-uploaded-source.png";
const cutout = "public/images/yanmar/cockpit-game-controls-cutout.png";

const overlay = String.raw`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="576" viewBox="0 0 1024 576">
  <defs>
    <linearGradient id="redPanel" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f23a32"/><stop offset=".55" stop-color="#d91f1c"/><stop offset="1" stop-color="#8e0b10"/></linearGradient>
    <linearGradient id="dark" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#252b33"/><stop offset="1" stop-color="#030405"/></linearGradient>
    <linearGradient id="floor" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#20252b"/><stop offset="1" stop-color="#0a0c0f"/></linearGradient>
  </defs>

  <ellipse cx="184" cy="75" rx="53" ry="62" fill="#000"/>
  <path d="M135 111 C145 155 223 155 235 112 L235 180 L130 180Z" fill="#000"/>
  <ellipse cx="842" cy="75" rx="55" ry="62" fill="#000"/>
  <path d="M790 112 C802 156 882 156 895 113 L895 181 L786 181Z" fill="#000"/>

  <path d="M456 89 H558 C566 89 572 96 571 104 L567 129 C563 136 451 136 447 129 L443 104 C442 96 448 89 456 89Z" fill="url(#redPanel)"/>
  <path d="M458 98 C483 91 532 91 557 98" fill="none" stroke="#ff7566" stroke-width="2" opacity=".28"/>
  <rect x="475" y="112" width="14" height="62" rx="7" fill="#050608" stroke="#616c77" stroke-width="2" opacity=".9"/>
  <rect x="525" y="112" width="14" height="62" rx="7" fill="#050608" stroke="#616c77" stroke-width="2" opacity=".9"/>
  <path d="M465 100 C474 94 491 94 499 101 M517 100 C526 94 544 94 551 101" fill="none" stroke="#ff7666" stroke-width="2" opacity=".32"/>

  <ellipse cx="312" cy="166" rx="27" ry="33" fill="#000"/>
  <path d="M304 188 C310 220 312 252 308 282" fill="none" stroke="#000" stroke-width="22" stroke-linecap="round"/>
  <rect x="300" y="248" width="18" height="58" rx="5" fill="url(#redPanel)" opacity=".92"/>

  <path d="M641 56 C671 61 690 88 683 123 C678 149 665 173 657 205" fill="none" stroke="#000" stroke-width="32" stroke-linecap="round" opacity=".98"/>
  <path d="M652 138 C664 153 665 181 655 211" fill="none" stroke="url(#dark)" stroke-width="14" stroke-linecap="round" opacity=".82"/>

  <rect x="636" y="226" width="66" height="101" rx="14" fill="url(#floor)"/>
  <path d="M648 240 H690 M646 255 H689 M644 270 H686 M642 286 H684 M641 302 H681" stroke="#3b444e" stroke-width="3" stroke-linecap="round" opacity=".55"/>
</svg>`;

async function transparentBlack(input, output, extract, { slope = 2.2, intercept = -22 } = {}) {
  const crop = sharp(input).extract(extract).ensureAlpha();
  const alpha = await sharp(input)
    .extract(extract)
    .greyscale()
    .linear(slope, intercept)
    .png()
    .toBuffer();

  await crop.joinChannel(alpha).png().toFile(output);
}

await sharp(source)
  .composite([{ input: Buffer.from(overlay), left: 0, top: 0 }])
  .png()
  .toFile(cutout);

await transparentBlack(source, "public/images/yanmar/main-joystick-left.png", {
  left: 125,
  top: 28,
  width: 122,
  height: 170,
});

await transparentBlack(source, "public/images/yanmar/main-joystick-right.png", {
  left: 782,
  top: 26,
  width: 126,
  height: 172,
});

await transparentBlack(source, "public/images/yanmar/safety-lever.png", {
  left: 294,
  top: 145,
  width: 40,
  height: 118,
}, { slope: 2.0, intercept: -30 });

console.log(`Generated ${cutout}`);
