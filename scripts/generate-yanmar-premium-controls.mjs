import sharp from "sharp";

const OUT = "public/images/yanmar";

const png = async (name, svg) => {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(`${OUT}/${name}`);
};

const defs = String.raw`
  <defs>
    <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#eef2f6"/>
      <stop offset="0.18" stop-color="#b9c0c9"/>
      <stop offset="0.62" stop-color="#69717d"/>
      <stop offset="1" stop-color="#272d36"/>
    </linearGradient>
    <linearGradient id="panelDark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#333b47"/>
      <stop offset="0.55" stop-color="#141922"/>
      <stop offset="1" stop-color="#05070a"/>
    </linearGradient>
    <linearGradient id="rubber" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4b5564"/>
      <stop offset="0.46" stop-color="#151a22"/>
      <stop offset="1" stop-color="#020304"/>
    </linearGradient>
    <linearGradient id="redLever" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff755c"/>
      <stop offset="0.42" stop-color="#d9201b"/>
      <stop offset="1" stop-color="#67100f"/>
    </linearGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7f9fb"/>
      <stop offset="0.3" stop-color="#9da6b1"/>
      <stop offset="0.64" stop-color="#3e4652"/>
      <stop offset="1" stop-color="#0b0e13"/>
    </linearGradient>
    <radialGradient id="gloss" cx="35%" cy="20%" r="70%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.78"/>
      <stop offset="0.28" stop-color="#cfd7df" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-35%" y="-35%" width="170%" height="185%">
      <feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
    <filter id="smallShadow" x="-45%" y="-45%" width="190%" height="190%">
      <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000000" flood-opacity="0.58"/>
    </filter>
    <filter id="innerGlow">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>`;

const svg = (width, height, body) => String.raw`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${defs}
${body}
</svg>`;

const cockpit = svg(1024, 576, String.raw`
  <g filter="url(#shadow)">
    <path d="M74 548 C98 312 111 188 168 122 C210 76 290 80 322 134 C348 177 340 304 319 548 Z" fill="url(#panel)"/>
    <path d="M950 548 C924 309 910 185 853 120 C812 76 731 80 702 137 C678 183 690 306 712 548 Z" fill="url(#panel)"/>
    <path d="M270 548 C280 346 318 176 446 115 C492 93 553 94 599 116 C727 178 755 350 762 548 Z" fill="url(#panel)"/>
    <path d="M116 550 C133 438 177 366 274 342 L750 342 C847 366 891 438 908 550 Z" fill="#10151d"/>
  </g>

  <g opacity="0.64">
    <path d="M96 536 C115 357 141 203 190 146 C223 107 278 112 299 152 C323 199 303 358 286 536 Z" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="3"/>
    <path d="M928 536 C908 357 883 202 834 146 C801 107 746 111 725 153 C702 200 722 358 739 536 Z" fill="none" stroke="#ffffff" stroke-opacity="0.31" stroke-width="3"/>
    <path d="M314 536 C326 354 361 205 463 151 C494 135 533 135 563 151 C666 205 699 354 710 536 Z" fill="none" stroke="#ffffff" stroke-opacity="0.28" stroke-width="3"/>
  </g>

  <g filter="url(#smallShadow)">
    <ellipse cx="186" cy="126" rx="72" ry="78" fill="url(#panelDark)"/>
    <ellipse cx="186" cy="122" rx="48" ry="45" fill="#0b0f15"/>
    <ellipse cx="186" cy="119" rx="34" ry="25" fill="#252c35"/>
    <path d="M135 160 C151 192 224 192 238 159 L252 246 L119 246 Z" fill="#8e96a2"/>

    <ellipse cx="843" cy="126" rx="74" ry="78" fill="url(#panelDark)"/>
    <ellipse cx="843" cy="122" rx="50" ry="45" fill="#0b0f15"/>
    <ellipse cx="843" cy="119" rx="35" ry="25" fill="#252c35"/>
    <path d="M790 160 C807 193 881 193 897 159 L910 247 L776 247 Z" fill="#89929e"/>
  </g>

  <g filter="url(#smallShadow)">
    <path d="M421 104 H602 C629 104 651 127 650 154 L639 284 H384 L373 154 C372 127 394 104 421 104 Z" fill="url(#panelDark)"/>
    <rect x="466" y="102" width="32" height="104" rx="16" fill="#080b10"/>
    <rect x="516" y="102" width="32" height="104" rx="16" fill="#080b10"/>
    <rect x="474" y="116" width="16" height="78" rx="8" fill="#2c3540"/>
    <rect x="524" y="116" width="16" height="78" rx="8" fill="#2c3540"/>
    <path d="M482 117 V193 M532 117 V193" stroke="#5e6874" stroke-opacity="0.7" stroke-width="2"/>
    <path d="M444 222 H580" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>
  </g>

  <g filter="url(#smallShadow)">
    <rect x="642" y="74" width="58" height="92" rx="23" fill="url(#panelDark)"/>
    <path d="M671 86 C686 110 685 139 670 155 C654 136 654 107 671 86 Z" fill="#090c11"/>
    <path d="M657 107 H683" stroke="#6d7886" stroke-width="4" stroke-linecap="round"/>
  </g>

  <g filter="url(#smallShadow)">
    <path d="M272 178 C283 154 333 154 345 178 L357 321 C362 374 253 374 259 321 Z" fill="url(#panelDark)"/>
    <path d="M310 184 C329 221 328 277 309 327 C290 277 291 221 310 184 Z" fill="#170708"/>
    <path d="M291 210 C301 199 319 199 329 210" fill="none" stroke="#c62828" stroke-opacity="0.45" stroke-width="5" stroke-linecap="round"/>
  </g>

  <g filter="url(#smallShadow)">
    <path d="M632 222 C658 203 698 213 715 245 L734 337 C740 365 718 389 689 389 H635 C606 389 586 365 592 337 L611 245 C615 236 622 228 632 222 Z" fill="#0d1118"/>
    <path d="M632 242 H697 L715 337 H611 Z" fill="url(#rubber)"/>
    <path d="M629 286 H700" stroke="#ffffff" stroke-opacity="0.13" stroke-width="4" stroke-linecap="round"/>
  </g>

  <g opacity="0.96">
    <rect x="803" y="42" width="96" height="48" rx="24" fill="#111720" filter="url(#smallShadow)"/>
    <circle cx="851" cy="66" r="18" fill="url(#redLever)"/>
    <path d="M842 66 C849 57 858 57 865 66 M838 58 C849 45 862 45 875 58" fill="none" stroke="#ffe9d2" stroke-width="4" stroke-linecap="round"/>
  </g>

  <g opacity="0.78">
    <rect x="418" y="293" width="188" height="42" rx="21" fill="#070a0f"/>
    <text x="512" y="320" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="800" fill="#f6f1e8" letter-spacing="2">YANMAR</text>
  </g>
`);

const joystick = ({ side, direction = "neutral" }) => {
  const dx = direction === "left" ? -12 : direction === "right" ? 12 : 0;
  const dy = direction === "up" ? -16 : direction === "down" ? 16 : 0;
  const lean = direction === "left" ? -8 : direction === "right" ? 8 : 0;
  const accent = side === "left" ? "#dc2626" : "#0ea5e9";

  return svg(160, 230, String.raw`
    <ellipse cx="80" cy="206" rx="47" ry="16" fill="#000000" opacity="0.42"/>
    <g filter="url(#smallShadow)" transform="translate(${dx} ${dy}) rotate(${lean} 80 182)">
      <path d="M70 190 C73 142 75 98 78 62 H88 C88 98 87 142 91 190 Z" fill="url(#steel)"/>
      <path d="M78 63 C87 103 87 146 84 188" fill="none" stroke="#ffffff" stroke-opacity="0.3" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="80" cy="190" rx="36" ry="21" fill="url(#rubber)"/>
      <path d="M50 188 C64 205 98 205 111 188" fill="none" stroke="#ffffff" stroke-opacity="0.13" stroke-width="4" stroke-linecap="round"/>
      <path d="M45 58 C45 24 64 10 83 10 C108 10 125 31 119 60 L112 92 C108 112 92 123 73 117 C55 111 45 94 45 58 Z" fill="url(#rubber)"/>
      <path d="M56 36 C67 21 91 18 105 33 C90 30 72 33 61 47 Z" fill="url(#gloss)"/>
      <path d="M48 64 C59 88 91 94 113 78" fill="none" stroke="${accent}" stroke-opacity="0.76" stroke-width="5" stroke-linecap="round"/>
    </g>
  `);
};

const travelLever = ({ side, direction = "neutral" }) => {
  const dy = direction === "forward" ? -18 : direction === "backward" ? 18 : 0;
  const tilt = direction === "forward" ? -4 : direction === "backward" ? 4 : 0;
  const accent = side === "left" ? "#38bdf8" : "#a78bfa";

  return svg(70, 148, String.raw`
    <ellipse cx="35" cy="132" rx="20" ry="8" fill="#000000" opacity="0.38"/>
    <g filter="url(#smallShadow)" transform="translate(0 ${dy}) rotate(${tilt} 35 122)">
      <path d="M31 120 C31 88 33 58 35 28 C38 58 40 88 39 120 Z" fill="url(#steel)"/>
      <rect x="22" y="16" width="26" height="56" rx="13" fill="url(#rubber)"/>
      <path d="M27 25 C34 18 43 22 45 32" fill="none" stroke="#ffffff" stroke-opacity="0.32" stroke-width="3" stroke-linecap="round"/>
      <path d="M24 54 H46" stroke="${accent}" stroke-opacity="0.82" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="35" cy="122" rx="18" ry="9" fill="#171d26"/>
    </g>
  `);
};

const safetyLever = ({ active }) => {
  const rot = active ? 11 : -11;
  const y = active ? 16 : -12;

  return svg(96, 172, String.raw`
    <ellipse cx="48" cy="154" rx="28" ry="10" fill="#000000" opacity="0.38"/>
    <g filter="url(#smallShadow)" transform="translate(0 ${y}) rotate(${rot} 48 146)">
      <path d="M41 138 C43 101 45 69 48 36 C53 69 55 101 55 138 Z" fill="#121820"/>
      <rect x="27" y="18" width="42" height="58" rx="20" fill="url(#redLever)"/>
      <path d="M36 26 C45 18 57 21 62 31" fill="none" stroke="#ffd3c7" stroke-opacity="0.68" stroke-width="4" stroke-linecap="round"/>
      <path d="M31 57 C40 68 58 68 66 57" fill="none" stroke="#410606" stroke-opacity="0.42" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="48" cy="140" rx="23" ry="13" fill="#0c1016"/>
    </g>
  `);
};

const hydraulicLever = ({ active }) => {
  const y = active ? -12 : 13;

  return svg(72, 116, String.raw`
    <ellipse cx="36" cy="101" rx="20" ry="7" fill="#000000" opacity="0.36"/>
    <g filter="url(#smallShadow)" transform="translate(0 ${y})">
      <path d="M33 88 C34 66 35 44 36 22 C38 44 39 66 39 88 Z" fill="url(#steel)"/>
      <rect x="19" y="13" width="34" height="38" rx="16" fill="url(#steel)"/>
      <path d="M27 20 C34 15 43 17 48 24" fill="none" stroke="#ffffff" stroke-opacity="0.46" stroke-width="3" stroke-linecap="round"/>
      <path d="M24 42 H48" stroke="${active ? "#38bdf8" : "#94a3b8"}" stroke-opacity="0.85" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="36" cy="90" rx="16" ry="8" fill="#111820"/>
    </g>
  `);
};

const pedal = ({ state = "neutral" }) => {
  const top = state === "top" ? 8 : 0;
  const bottom = state === "bottom" ? -8 : 0;

  return svg(112, 178, String.raw`
    <ellipse cx="56" cy="160" rx="44" ry="12" fill="#000000" opacity="0.42"/>
    <g filter="url(#smallShadow)">
      <path d="M24 13 H88 C99 13 106 23 103 34 L88 150 C86 159 78 165 69 165 H43 C34 165 26 159 24 150 L9 34 C6 23 13 13 24 13 Z" fill="#090d13"/>
      <path d="M26 25 H86 L96 84 H16 Z" fill="url(#rubber)" transform="translate(0 ${top})"/>
      <path d="M16 94 H96 L86 153 H26 Z" fill="url(#rubber)" transform="translate(0 ${bottom})"/>
      <path d="M28 45 H84 M25 62 H87 M22 118 H90 M27 136 H85" stroke="#ffffff" stroke-opacity="0.18" stroke-width="4" stroke-linecap="round"/>
      <path d="M18 86 H94" stroke="#020304" stroke-width="5" stroke-linecap="round"/>
      <path d="M30 27 C43 21 72 21 85 27" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="4" stroke-linecap="round"/>
    </g>
  `);
};

await png("cockpit-game-controls-cutout.png", cockpit);
await png("cockpit-base-no-moving-controls.png", cockpit);

for (const side of ["left", "right"]) {
  for (const direction of ["neutral", "up", "down", "left", "right"]) {
    await png(`main-joystick-${side}-${direction}.png`, joystick({ side, direction }));
  }
  await png(`main-joystick-${side}.png`, joystick({ side, direction: "neutral" }));

  for (const direction of ["neutral", "forward", "backward"]) {
    await png(`travel-lever-${side}-${direction}.png`, travelLever({ side, direction }));
  }
  await png(`travel-lever-${side}.png`, travelLever({ side, direction: "neutral" }));
}

await png("safety-lever-on.png", safetyLever({ active: true }));
await png("safety-lever-off.png", safetyLever({ active: false }));
await png("safety-lever.png", safetyLever({ active: false }));
await png("hydraulic-speed-lever-on.png", hydraulicLever({ active: true }));
await png("hydraulic-speed-lever-off.png", hydraulicLever({ active: false }));
await png("hydraulic-lever-knob.png", hydraulicLever({ active: false }));
await png("pedal-neutral.png", pedal({ state: "neutral" }));
await png("pedal-top-pressed.png", pedal({ state: "top" }));
await png("pedal-bottom-pressed.png", pedal({ state: "bottom" }));

console.log("Generated premium Yanmar cockpit controls");
