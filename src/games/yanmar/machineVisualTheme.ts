import * as THREE from "three";

export const YANMAR_MACHINE_RIG = {
  boomLength: 3,
  armLength: 2.5,
  bucketLength: 1.2,
  boomPivotY: 1.68,
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
  /** Bucket-local jaw samples for grapple wrap (teeth → mouth → tip). */
  grappleTeethLocalX: -1.02,
  grappleTeethLocalY: -0.46,
  /** Mouth center between hydraulic thumb and bucket teeth. */
  grappleClampLocalX: -1.05,
  grappleClampLocalY: -0.32,
  grappleMouthLocalX: -0.88,
  grappleMouthLocalY: -0.18,
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

/** Upper-body side model mark (e.g. ViO17-1, SV100-7). */
export function createChassisModelSideBrandTexture(modelPlate: string): {
  texture: THREE.Texture;
  aspect: number;
} | null {
  if (typeof document === "undefined" || !modelPlate) return null;

  const scale = 6;
  const baseWidth = 720;
  const baseHeight = 200;
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
  const fontSize = Math.min(92, Math.max(54, Math.floor(640 / modelPlate.length)));
  ctx.font = `900 ${fontSize}px ${fontStack}`;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#0b0f14";
  ctx.lineWidth = Math.max(7, fontSize * 0.11);
  ctx.strokeText(modelPlate, baseWidth / 2, baseHeight / 2 + 4);
  const fill = ctx.createLinearGradient(0, 40, 0, baseHeight - 40);
  fill.addColorStop(0, "#ffffff");
  fill.addColorStop(0.55, "#f3f6f8");
  fill.addColorStop(1, "#c8d2da");
  ctx.fillStyle = fill;
  ctx.fillText(modelPlate, baseWidth / 2, baseHeight / 2 + 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  return { texture, aspect: baseWidth / baseHeight };
}
