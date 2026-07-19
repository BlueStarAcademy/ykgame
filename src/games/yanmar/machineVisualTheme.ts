import * as THREE from "three";

export const YANMAR_MACHINE_RIG = {
  boomLength: 3,
  armLength: 2.5,
  bucketLength: 1.2,
  boomPivotY: 1.68,
  /**
   * Gooseneck boom visual kink (fraction of boomLength / metres).
   * Keep in sync with workEquipment ReferenceBoom.
   */
  /**
   * Gooseneck ~45° bend — kink past mid-boom so the upper (sky / arm) leg
   * is shorter than the lower (chassis) leg.
   */
  boomGooseneckKinkAlong: 0.55,
  boomGooseneckKinkRise: 0.24,
  boomGooseneckKinkRiseCap: 0.78,
  /** Body-local +X of boom foot relative to undercarriage swing center */
  boomOffset: 0.8,
  /** Undercarriage swing / house yaw axis in body local +X */
  swingPivotX: 0,
  /**
   * Raise rotating house + boom above track tops (world metres in model space).
   * Must stay in sync with ExcavatorModel SWING_HOUSE_LIFT_Y usage.
   */
  swingHouseLiftY: 0.34,
  /** 암 관절 입력을 과장하지 않고 실제 각도로 표시한다. */
  armRotationScale: 1,
  bucketRotationScale: 1.02,
  breakerRotationZ: -0.08,
  breakerTipLocalX: -2.18,
  breakerTipLocalY: -0.15,
  /**
   * Grab mouth in bucket-local:
   * teeth = fixed jaw, clamp = between teeth and open-thumb path,
   * so a rock sits in the gap then gets pressed into the bucket.
   */
  grappleTeethLocalX: -1.25,
  grappleTeethLocalY: -0.29,
  grappleClampLocalX: -1.14,
  grappleClampLocalY: -0.28,
  grappleMouthLocalX: -0.7,
  grappleMouthLocalY: 0.15,
  /** 블레이드 0=상승, 1=하강 시 그룹 Y 하강량 */
  dozerBladeDrop: 0.55,
  dozerBladeGroupBaseY: 0.72,
  dozerBladeMeshLocalY: -0.08,
  dozerBladeHalfHeight: 0.26,
  /** 모델 로컬 +X (회전 후 전방) 기준 블레이드 접촉점 */
  dozerBladeReach: 1.05,
  /**
   * PremiumDozerBlade 메시 그룹의 로컬 +X.
   * blade group X + 이 값 = dozerBladeReach (기준 차체).
   */
  dozerBladeMeshLocalX: 1.8,
  excavatorVisualY: 0.68,
} as const;

/** Local pitch of the chassis-side gooseneck segment above the boom axis. */
export function getBoomGooseneckLowerAngle(
  boomLength = YANMAR_MACHINE_RIG.boomLength,
): number {
  const kinkX = boomLength * YANMAR_MACHINE_RIG.boomGooseneckKinkAlong;
  const kinkY = Math.min(
    YANMAR_MACHINE_RIG.boomGooseneckKinkRiseCap,
    boomLength * YANMAR_MACHINE_RIG.boomGooseneckKinkRise,
  );
  return Math.atan2(kinkY, kinkX);
}

/**
 * Max boom raise (min joint): chassis-side boom segment stands vertical
 * (90° to ground). Smaller values fold past vertical into the cab.
 */
export function getBoomRaiseMinJoint(
  boomLength = YANMAR_MACHINE_RIG.boomLength,
): number {
  return getBoomGooseneckLowerAngle(boomLength);
}

/** Chassis scale/trackWidth에 맞춰 블레이드가 궤도 앞에 남도록 reach 계산. */
export function getDozerBladeReach(scale = 1, trackWidth = 1): number {
  const s = Math.max(0.85, scale);
  const tw = Math.max(0.85, trackWidth);
  // Track front ≈ (straight half + loop radius) * trackScaleX * visual.scale
  const trackFront = 0.72 * tw * s;
  const overhang = YANMAR_MACHINE_RIG.dozerBladeReach - 0.72;
  return trackFront + overhang * s;
}

/** Center-carbody width between tracks (matches UndercarriageAssembly). */
export function getCarbodyWidth(trackWidth = 1): number {
  const tw = Math.max(0.85, trackWidth);
  const trackScaleZ = 0.82 * tw;
  const trackCenterZ = 0.72 * trackScaleZ;
  const trackHalfZ = 0.3 * trackScaleZ;
  return Math.max(0.42, (trackCenterZ - trackHalfZ) * 2 + 0.08 * trackScaleZ);
}

/** Dozer push-arm half-spacing — stays inside carbody, never on the track centers. */
export function getDozerArmHalfWidth(trackWidth = 1): number {
  return getCarbodyWidth(trackWidth) * 0.28;
}

export const YANMAR_MACHINE_COLORS = {
  paintRed: "#e2231a",
  paintRedBright: "#ff3b2f",
  paintRedDark: "#8f1111",
  paintHighlight: "#ff7567",
  frame: "#141a20",
  frameLight: "#2b353e",
  rubber: "#090d10",
  rubberHighlight: "#1d282f",
  trackChain: "#626b72",
  steel: "#788894",
  steelBright: "#dce5eb",
  dozerBlade: "#555d63",
  dozerBladeEdge: "#939ba1",
  dozerBladeArm: "#3f474d",
  chrome: "#edf4f7",
  glass: "#17323a",
  interior: "#242b32",
  warning: "#ffb629",
  lamp: "#fff6da",
  truckBed: "#d8242a",
  truckBedDark: "#771216",
} as const;

export const YANMAR_MACHINE_MATERIALS = {
  painted: {
    roughness: 0.24,
    metalness: 0.24,
  },
  paintedDark: {
    roughness: 0.38,
    metalness: 0.2,
  },
  frame: {
    roughness: 0.42,
    metalness: 0.44,
  },
  rubber: {
    roughness: 0.72,
    metalness: 0.08,
  },
  steel: {
    roughness: 0.24,
    metalness: 0.72,
  },
  glass: {
    roughness: 0.08,
    metalness: 0.12,
    transparent: true,
    opacity: 0.72,
  },
} as const;

/** White number-plate face with official YK건기 mark (black "건기") + phone line. */
export function createYkGeongiNumberPlateTexture(
  logo: CanvasImageSource,
  displayText: string,
) {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 560;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const roundedRect = (x: number, y: number, width: number, height: number, radius: number) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  const w = canvas.width;
  const h = canvas.height;
  const metal = ctx.createLinearGradient(0, 0, 0, h);
  metal.addColorStop(0, "#f8fbfd");
  metal.addColorStop(0.28, "#8b9aa6");
  metal.addColorStop(0.5, "#e8eef2");
  metal.addColorStop(0.72, "#6d7d89");
  metal.addColorStop(1, "#dce5ea");
  roundedRect(16, 16, w - 32, h - 32, 72);
  ctx.fillStyle = metal;
  ctx.fill();

  const numberPlateFace = ctx.createLinearGradient(0, 40, 0, h - 40);
  numberPlateFace.addColorStop(0, "#ffffff");
  numberPlateFace.addColorStop(0.55, "#f7f9fa");
  numberPlateFace.addColorStop(1, "#e8edf0");
  roundedRect(40, 40, w - 80, h - 80, 56);
  ctx.fillStyle = numberPlateFace;
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#b8c0c6";
  ctx.stroke();

  roundedRect(62, 62, w - 124, h - 124, 42);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#d5dce1";
  ctx.stroke();

  const cx = w / 2;
  const brandY = Math.round(h * 0.28);
  const numberY = Math.round(h * 0.66);
  const logoMaxW = w * 0.62;
  const logoMaxH = h * 0.28;
  const logoW =
    "width" in logo && typeof logo.width === "number" && logo.width > 0
      ? logo.width
      : 1024;
  const logoH =
    "height" in logo && typeof logo.height === "number" && logo.height > 0
      ? logo.height
      : 258;
  const logoScale = Math.min(logoMaxW / logoW, logoMaxH / logoH);
  const drawW = logoW * logoScale;
  const drawH = logoH * logoScale;
  ctx.drawImage(logo, cx - drawW / 2, brandY - drawH / 2, drawW, drawH);

  const divider = ctx.createLinearGradient(w * 0.1, 0, w * 0.9, 0);
  divider.addColorStop(0, "rgba(120,130,138,0)");
  divider.addColorStop(0.5, "rgba(120,130,138,0.5)");
  divider.addColorStop(1, "rgba(120,130,138,0)");
  ctx.fillStyle = divider;
  ctx.fillRect(w * 0.12, h * 0.46, w * 0.76, 4);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const latinFont = '"Arial Black", Arial, sans-serif';
  let fontSize = 210;
  do {
    ctx.font = `900 ${fontSize}px ${latinFont}`;
    fontSize -= 4;
  } while (ctx.measureText(displayText).width > w * 0.82 && fontSize > 120);
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = "#2a3238";
  ctx.fillText(displayText, cx, numberY);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  return texture;
}

/** Configure a loaded YK건기 WebP logo for transparent decals. */
export function configureYkGeongiLogoTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.premultiplyAlpha = false;
  texture.needsUpdate = true;
}

/**
 * Boom side decal: light padding only — no opaque plate / white halo background.
 * Soft dark edge so YK red/blue still reads on paintRed without a fake backdrop.
 */
export function createYkGeongiBoomDecalTexture(
  source: CanvasImageSource,
  outlinePx = 3,
): { texture: THREE.Texture; aspect: number } | null {
  if (typeof document === "undefined") return null;

  const w =
    "naturalWidth" in source && source.naturalWidth
      ? source.naturalWidth
      : "width" in source && typeof source.width === "number"
        ? source.width
        : 0;
  const h =
    "naturalHeight" in source && source.naturalHeight
      ? source.naturalHeight
      : "height" in source && typeof source.height === "number"
        ? source.height
        : 0;
  if (!w || !h) return null;

  const pad = Math.ceil(outlinePx * 2.5);
  const canvas = document.createElement("canvas");
  canvas.width = w + pad * 2;
  canvas.height = h + pad * 2;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = `drop-shadow(0 0 ${outlinePx}px rgba(0,0,0,0.55))`;
  ctx.drawImage(source, pad, pad);
  ctx.filter = "none";
  ctx.drawImage(source, pad, pad);

  const texture = new THREE.CanvasTexture(canvas);
  configureYkGeongiLogoTexture(texture);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  return { texture, aspect: canvas.width / canvas.height };
}

function configureSideBrandTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.premultiplyAlpha = false;
  texture.needsUpdate = true;
}

/**
 * Factory ViO 17HD side mark (ViO + large 17 + HD).
 * Used for the default ViO17-1 chassis side decal.
 */
export function createVio17HdSideBrandTexture(): {
  texture: THREE.Texture;
  aspect: number;
} | null {
  if (typeof document === "undefined") return null;

  const scale = 5;
  const baseWidth = 760;
  const baseHeight = 240;
  const canvas = document.createElement("canvas");
  canvas.width = baseWidth * scale;
  canvas.height = baseHeight * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, baseWidth, baseHeight);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const fontStack =
    'Arial Black, Impact, "Helvetica Neue", Arial, sans-serif';
  const shear = -0.18;

  const setFont = (size: number) => {
    ctx.font = `900 ${size}px ${fontStack}`;
  };

  const measure = (text: string, size: number) => {
    setFont(size);
    return ctx.measureText(text).width;
  };

  const vioSize = 86;
  const numSize = 162;
  const hdSize = 54;
  const vioW = measure("ViO", vioSize);
  const numW = measure("17", numSize);
  const gapVioNum = 8;
  const contentW = vioW + gapVioNum + numW + hdSize * 0.55;
  const originX = (baseWidth - contentW) / 2 + 12;
  const numX = originX + vioW + gapVioNum;
  const baseline = 178;

  const makeFill = (top: number, bottom: number) => {
    const gradient = ctx.createLinearGradient(0, top, 0, bottom);
    gradient.addColorStop(0, "#d8dee3");
    gradient.addColorStop(0.18, "#ffffff");
    gradient.addColorStop(0.82, "#ffffff");
    gradient.addColorStop(1, "#eef2f5");
    return gradient;
  };

  const drawMark = (
    text: string,
    x: number,
    y: number,
    size: number,
    strokeWidth: number,
  ) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.transform(1, 0, shear, 1, 0, 0);
    setFont(size);

    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1.5;
    ctx.shadowOffsetY = 2.5;
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = "#070b0f";
    ctx.strokeText(text, 0, 0);

    ctx.shadowColor = "transparent";
    ctx.lineWidth = Math.max(1.5, strokeWidth * 0.22);
    ctx.strokeStyle = "rgba(12, 18, 24, 0.65)";
    ctx.strokeText(text, 0, 0);

    ctx.fillStyle = makeFill(-size * 0.86, size * 0.1);
    ctx.fillText(text, 0, 0);

    ctx.save();
    ctx.beginPath();
    ctx.rect(-size * 0.15, -size * 0.92, size * 4, size * 0.34);
    ctx.clip();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, 0, 0);
    ctx.restore();

    ctx.restore();
  };

  drawMark("ViO", originX, baseline - 22, vioSize, 12);
  drawMark("17", numX, baseline, numSize, 18);
  drawMark("HD", numX + numW * 0.7, baseline + 4, hdSize, 8.5);

  const texture = new THREE.CanvasTexture(canvas);
  configureSideBrandTexture(texture);
  return { texture, aspect: baseWidth / baseHeight };
}

/** Upper-body side model mark (e.g. ViO17-1, SV100-7). */
export function createChassisModelSideBrandTexture(modelPlate: string): {
  texture: THREE.Texture;
  aspect: number;
} | null {
  if (typeof document === "undefined" || !modelPlate) return null;

  // Default chassis keeps the premium ViO 17HD factory mark.
  if (modelPlate === "ViO17-1") {
    return createVio17HdSideBrandTexture();
  }

  const scale = 6;
  const baseWidth = 780;
  const baseHeight = 240;
  const canvas = document.createElement("canvas");
  canvas.width = baseWidth * scale;
  canvas.height = baseHeight * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, baseWidth, baseHeight);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fontStack =
    'Arial Black, Impact, "Helvetica Neue", Arial, sans-serif';
  // Keep long plates (ViO35-7A-CJR) readable without clipping.
  const fontSize = Math.min(
    130,
    Math.max(78, Math.floor(820 / modelPlate.length)),
  );
  ctx.font = `900 ${fontSize}px ${fontStack}`;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#0b0f14";
  ctx.lineWidth = Math.max(9, fontSize * 0.12);
  ctx.strokeText(modelPlate, baseWidth / 2, baseHeight / 2 + 4);
  const fill = ctx.createLinearGradient(0, 48, 0, baseHeight - 48);
  fill.addColorStop(0, "#ffffff");
  fill.addColorStop(0.55, "#f3f6f8");
  fill.addColorStop(1, "#c8d2da");
  ctx.fillStyle = fill;
  ctx.fillText(modelPlate, baseWidth / 2, baseHeight / 2 + 4);

  const texture = new THREE.CanvasTexture(canvas);
  configureSideBrandTexture(texture);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  return { texture, aspect: baseWidth / baseHeight };
}
