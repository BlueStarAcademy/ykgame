import * as THREE from "three";

export const YANMAR_MACHINE_RIG = {
  boomLength: 3,
  armLength: 2.5,
  bucketLength: 1.2,
  boomPivotY: 1.68,
  boomOffset: 0.8,
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
  excavatorVisualY: 0.68,
} as const;

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

export function createYkGeongiMarkTexture(displayText?: string) {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = displayText ? 1600 : 1200;
  canvas.height = displayText ? 560 : 420;
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

  const finishTexture = () => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 16;
    texture.needsUpdate = true;
    return texture;
  };

  if (displayText) {
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

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;

    const cx = w / 2;
    const brandY = Math.round(h * 0.3);
    const numberY = Math.round(h * 0.66);
    const latinFont = '"Arial Black", Arial, sans-serif';
    const koreanFont =
      '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

    // Top line — YK건기
    const brandSize = 118;
    ctx.font = `900 ${brandSize}px ${latinFont}`;
    const yW = ctx.measureText("Y").width;
    const kW = ctx.measureText("K").width;
    ctx.font = `900 ${brandSize}px ${koreanFont}`;
    const geongiW = ctx.measureText("건기").width;
    const brandGap = 14;
    const brandTotal = yW + kW + brandGap + geongiW;
    let brandX = cx - brandTotal / 2;

    ctx.shadowColor = "rgba(0,0,0,0.14)";
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;

    ctx.font = `900 ${brandSize}px ${latinFont}`;
    ctx.fillStyle = "#1565c0";
    ctx.fillText("Y", brandX + yW / 2, brandY);
    brandX += yW;
    ctx.fillStyle = "#c62828";
    ctx.fillText("K", brandX + kW / 2, brandY);
    brandX += kW + brandGap;

    ctx.font = `900 ${brandSize}px ${koreanFont}`;
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(20, 28, 34, 0.22)";
    ctx.strokeText("건기", brandX + geongiW / 2, brandY);
    ctx.fillStyle = "#141b21";
    ctx.fillText("건기", brandX + geongiW / 2, brandY);

    const divider = ctx.createLinearGradient(w * 0.1, 0, w * 0.9, 0);
    divider.addColorStop(0, "rgba(120,130,138,0)");
    divider.addColorStop(0.5, "rgba(120,130,138,0.5)");
    divider.addColorStop(1, "rgba(120,130,138,0)");
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = divider;
    ctx.fillRect(w * 0.12, h * 0.46, w * 0.76, 4);

    // Bottom line — plate number
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

    return finishTexture();
  }

  const metal = ctx.createLinearGradient(0, 0, 0, canvas.height);
  metal.addColorStop(0, "#f8fbfd");
  metal.addColorStop(0.28, "#8b9aa6");
  metal.addColorStop(0.5, "#e8eef2");
  metal.addColorStop(0.72, "#6d7d89");
  metal.addColorStop(1, "#dce5ea");
  roundedRect(12, 12, 1176, 396, 62);
  ctx.fillStyle = metal;
  ctx.fill();

  const face = ctx.createLinearGradient(0, 28, 0, 392);
  face.addColorStop(0, "#202d37");
  face.addColorStop(0.45, "#111a21");
  face.addColorStop(1, "#080d12");
  roundedRect(30, 30, 1140, 360, 48);
  ctx.fillStyle = face;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255,255,255,0.42)";
  ctx.stroke();

  const shine = ctx.createLinearGradient(0, 55, 0, 180);
  shine.addColorStop(0, "rgba(255,255,255,0.2)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  roundedRect(52, 52, 1096, 132, 32);
  ctx.fillStyle = shine;
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";

  ctx.font = '900 210px "Arial Black", Arial, sans-serif';
  ctx.lineWidth = 7;
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.fillStyle = "#1976d2";
  ctx.strokeText("Y", 202, 210);
  ctx.fillText("Y", 202, 210);
  ctx.fillStyle = "#e3262e";
  ctx.strokeText("K", 348, 210);
  ctx.fillText("K", 348, 210);

  const divider = ctx.createLinearGradient(0, 90, 0, 330);
  divider.addColorStop(0, "rgba(255,255,255,0)");
  divider.addColorStop(0.5, "#dce5ea");
  divider.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = divider;
  ctx.fillRect(488, 82, 4, 256);

  ctx.font = '900 168px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.fillStyle = "#f7fafc";
  ctx.strokeText("건기", 790, 190);
  ctx.fillText("건기", 790, 190);
  ctx.font = '700 35px Arial, "Helvetica Neue", sans-serif';
  ctx.fillStyle = "#aebbc5";
  ctx.fillText("HEAVY EQUIPMENT", 790, 305);

  return finishTexture();
}

export function createYkGeongiWhiteTextTexture() {
  if (typeof document === "undefined") return null;

  const scale = 4;
  const baseWidth = 512;
  const baseHeight = 160;
  const canvas = document.createElement("canvas");
  canvas.width = baseWidth * scale;
  canvas.height = baseHeight * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, baseWidth, baseHeight);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.shadowColor = "rgba(0,0,0,0.72)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 2;

  const latinFont = '"Arial Black", Arial, sans-serif';
  const koreanFont =
    '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const letterSize = 84;
  const geongiSize = 78;

  const drawBrandLetter = (letter: string, x: number, y: number, color: string) => {
    ctx.font = `900 ${letterSize}px ${latinFont}`;
    ctx.lineWidth = 11;
    ctx.strokeStyle = "rgba(15,23,42,0.92)";
    ctx.strokeText(letter, x, y);
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeText(letter, x, y);
    ctx.fillStyle = color;
    ctx.fillText(letter, x, y);
  };

  const drawGeongi = (x: number, y: number) => {
    ctx.font = `900 ${geongiSize}px ${koreanFont}`;
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(15,23,42,0.96)";
    ctx.strokeText("건기", x, y);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("건기", x, y);
  };

  drawBrandLetter("Y", 150, 82, "#1976d2");
  drawBrandLetter("K", 220, 82, "#e3262e");
  drawGeongi(350, 82);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  return texture;
}
