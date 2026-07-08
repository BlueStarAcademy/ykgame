import sharp from "sharp";

const source = "public/images/yanmar/cockpit-game-controls-uploaded-source.png";
const cockpit = "public/images/yanmar/cockpit-game-controls-cutout.png";
const cockpitBase = "public/images/yanmar/cockpit-base-no-moving-controls.png";

const MAIN_JOYSTICK_LEFT = { left: 112, top: 22, width: 148, height: 252 };
const MAIN_JOYSTICK_RIGHT = { left: 770, top: 20, width: 150, height: 254 };
const SAFETY_LEVER = {
  extract: { left: 286, top: 176, width: 48, height: 98 },
  seed: { x: 310, y: 214 },
};
const HYDRAULIC_SPEED = {
  extract: { left: 650, top: 80, width: 36, height: 52 },
  seed: { x: 666, y: 103 },
};
const TRAVEL_LEFT = { left: 466, top: 82, width: 28, height: 94 };
const TRAVEL_RIGHT = { left: 516, top: 82, width: 28, height: 94 };
const PEDAL = { left: 636, top: 226, width: 66, height: 101 };

const BRIGHT_BACKGROUND = { r: 203, g: 213, b: 225, alpha: 1 };

/** 작은 토글 레버만 베이스에서 제거한다. 큰 조이스틱/주행레버는 원본 그대로 유지한다. */
const movingSmallControlsMask = String.raw`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="576" viewBox="0 0 1024 576">
  <defs>
    <linearGradient id="redSlot" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#971515"/>
      <stop offset="100%" stop-color="#1b1113"/>
    </linearGradient>
  </defs>
  <ellipse cx="310" cy="212" rx="18" ry="33" fill="url(#redSlot)"/>
  <path d="M304 188 C310 220 312 252 308 282" fill="none" stroke="#1b1113" stroke-width="20" stroke-linecap="round"/>
  <ellipse cx="666" cy="103" rx="14" ry="20" fill="#2b313a"/>
</svg>`;

function isRedSafetyPixel(r, g, b) {
  const sum = r + g + b;
  if (sum < 12) return false;
  const isGrey = Math.abs(r - g) < 18 && Math.abs(g - b) < 18 && r > 55 && r < 190;
  if (isGrey) return false;
  const isRed = r > 125 && g < 125 && b < 115 && r > g + 22 && r > b + 22;
  const isDarkStem = r < 58 && g < 58 && b < 58 && sum > 18 && sum < 135;
  return isRed || isDarkStem;
}

function isHydraulicPixel(r, g, b) {
  const sum = r + g + b;
  if (sum < 26) return false;
  const isGreyKnob =
    r > 70 &&
    g > 70 &&
    b > 66 &&
    r < 215 &&
    Math.abs(r - g) < 42 &&
    Math.abs(g - b) < 46;
  const isDarkStem = r < 60 && g < 60 && b < 60 && sum > 16 && sum < 135;
  return isGreyKnob || isDarkStem;
}

async function transparentBlack(input, output, extract, options = {}) {
  const { slope = 2.2, intercept = -22 } = options;
  const crop = sharp(input).extract(extract).ensureAlpha();
  const alpha = await sharp(input)
    .extract(extract)
    .greyscale()
    .linear(slope, intercept)
    .png()
    .toBuffer();

  await crop.joinChannel(alpha).png().toFile(output);
}

async function edgeBlackTransparent(input, output, extract, threshold = 2) {
  const { data, info } = await sharp(input)
    .extract(extract)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  const isBackground = (x, y) => {
    const pi = (y * width + x) * 4;
    return data[pi] <= threshold && data[pi + 1] <= threshold && data[pi + 2] <= threshold;
  };

  const push = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = y * width + x;
    if (visited[idx] || !isBackground(x, y)) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (queue.length > 0) {
    const idx = queue.pop();
    const x = idx % width;
    const y = (idx - x) / width;
    data[idx * 4 + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(output);
}

async function fillExteriorBlack(input, output, threshold = 12) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  const isExteriorBackground = (x, y) => {
    const pi = (y * width + x) * 4;
    return data[pi] <= threshold && data[pi + 1] <= threshold && data[pi + 2] <= threshold;
  };

  const push = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = y * width + x;
    if (visited[idx] || !isExteriorBackground(x, y)) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (queue.length > 0) {
    const idx = queue.pop();
    const x = idx % width;
    const y = (idx - x) / width;
    const pi = idx * 4;
    data[pi] = BRIGHT_BACKGROUND.r;
    data[pi + 1] = BRIGHT_BACKGROUND.g;
    data[pi + 2] = BRIGHT_BACKGROUND.b;
    data[pi + 3] = 255;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(output);
}

async function extractConnectedMask(input, extract, seed, isPixel) {
  const { data, info } = await sharp(input)
    .extract(extract)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];
  const seedX = seed.x - extract.left;
  const seedY = seed.y - extract.top;

  const push = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const pi = idx * 4;
    if (!isPixel(data[pi], data[pi + 1], data[pi + 2])) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  push(seedX, seedY);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) push(seedX + dx, seedY + dy);
  }

  while (queue.length > 0) {
    const idx = queue.pop();
    const x = idx % width;
    const y = (idx - x) / width;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  for (let idx = 0; idx < width * height; idx++) {
    data[idx * 4 + 3] = visited[idx] ? 255 : 0;
  }

  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function writeConnectedSprite(input, output, config, isPixel) {
  const buffer = await extractConnectedMask(input, config.extract, config.seed, isPixel);
  await sharp(buffer).trim().png().toFile(output);
}

async function writeStateSprite(maskedBuffer, output, { canvasWidth, canvasHeight, x, y }) {
  await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: maskedBuffer, left: x, top: y }])
    .png()
    .toFile(output);
}

async function copySprite(sourcePath, outputPath) {
  await sharp(sourcePath).png().toFile(outputPath);
}

async function writeJoystickSet(side, extract) {
  const neutral = `public/images/yanmar/main-joystick-${side}-neutral.png`;
  await edgeBlackTransparent(source, neutral, extract);

  // 원본 파츠 형태를 유지한다. 실제 위치/기울임은 React transform이 담당한다.
  for (const direction of ["up", "down", "left", "right"]) {
    await copySprite(neutral, `public/images/yanmar/main-joystick-${side}-${direction}.png`);
  }
  await copySprite(neutral, `public/images/yanmar/main-joystick-${side}.png`);
}

async function writeTravelSet(side, extract) {
  const neutral = `public/images/yanmar/travel-lever-${side}-neutral.png`;
  await edgeBlackTransparent(source, neutral, extract);
  await copySprite(neutral, `public/images/yanmar/travel-lever-${side}-forward.png`);
  await copySprite(neutral, `public/images/yanmar/travel-lever-${side}-backward.png`);
  await copySprite(neutral, `public/images/yanmar/travel-lever-${side}.png`);
}

async function writeSafetyStates() {
  const sprite = await extractConnectedMask(
    source,
    SAFETY_LEVER.extract,
    SAFETY_LEVER.seed,
    isRedSafetyPixel,
  );
  const trimmed = await sharp(sprite).trim().png().toBuffer();
  await sharp(trimmed).png().toFile("public/images/yanmar/safety-lever.png");
  await writeStateSprite(trimmed, "public/images/yanmar/safety-lever-off.png", {
    canvasWidth: 54,
    canvasHeight: 104,
    x: 3,
    y: 0,
  });
  await writeStateSprite(trimmed, "public/images/yanmar/safety-lever-on.png", {
    canvasWidth: 54,
    canvasHeight: 104,
    x: 3,
    y: 14,
  });
}

async function writeHydraulicStates() {
  const sprite = await extractConnectedMask(
    source,
    HYDRAULIC_SPEED.extract,
    HYDRAULIC_SPEED.seed,
    isHydraulicPixel,
  );
  const trimmed = await sharp(sprite).trim().png().toBuffer();
  await sharp(trimmed).png().toFile("public/images/yanmar/hydraulic-lever-knob.png");
  await writeStateSprite(trimmed, "public/images/yanmar/hydraulic-speed-lever-off.png", {
    canvasWidth: 42,
    canvasHeight: 64,
    x: 4,
    y: 12,
  });
  await writeStateSprite(trimmed, "public/images/yanmar/hydraulic-speed-lever-on.png", {
    canvasWidth: 42,
    canvasHeight: 64,
    x: 4,
    y: 0,
  });
}

async function writePedalStates() {
  await edgeBlackTransparent(source, "public/images/yanmar/pedal-neutral.png", PEDAL);
  await copySprite("public/images/yanmar/pedal-neutral.png", "public/images/yanmar/pedal-top-pressed.png");
  await copySprite(
    "public/images/yanmar/pedal-neutral.png",
    "public/images/yanmar/pedal-bottom-pressed.png",
  );
}

const baseWithoutSmallControls = await sharp(source)
  .composite([{ input: Buffer.from(movingSmallControlsMask), left: 0, top: 0 }])
  .png()
  .toBuffer();

await fillExteriorBlack(baseWithoutSmallControls, cockpitBase);
await copySprite(cockpitBase, cockpit);

await writeJoystickSet("left", MAIN_JOYSTICK_LEFT);
await writeJoystickSet("right", MAIN_JOYSTICK_RIGHT);
await writeTravelSet("left", TRAVEL_LEFT);
await writeTravelSet("right", TRAVEL_RIGHT);
await writeSafetyStates();
await writeHydraulicStates();
await writePedalStates();

console.log("Generated cockpit base and reusable original-image control sprites");
