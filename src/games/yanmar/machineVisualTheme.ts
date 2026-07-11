import * as THREE from "three";

export const YANMAR_MACHINE_RIG = {
  boomLength: 3,
  armLength: 2.5,
  bucketLength: 1.2,
  boomPivotY: 1.68,
  boomOffset: 0.8,
  armRotationScale: 1.18,
  bucketRotationScale: 1.02,
  breakerRotationZ: -0.08,
  breakerTipLocalX: -2.18,
  breakerTipLocalY: -0.15,
  /** Bucket-local grip point — between thumb and teeth, slightly toward the tip. */
  grappleClampLocalX: -1.05,
  grappleClampLocalY: -0.28,
  /** 블레이드 0=상승, 1=하강 시 그룹 Y 하강량 */
  dozerBladeDrop: 0.55,
  dozerBladeGroupBaseY: 0.72,
  dozerBladeMeshLocalY: -0.08,
  dozerBladeHalfHeight: 0.285,
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
  canvas.width = 1200;
  canvas.height = 420;
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
  if (displayText) {
    const numberPlateFace = ctx.createLinearGradient(0, 30, 0, 390);
    numberPlateFace.addColorStop(0, "#ffffff");
    numberPlateFace.addColorStop(0.55, "#f4f6f7");
    numberPlateFace.addColorStop(1, "#e5e9ec");
    roundedRect(30, 30, 1140, 360, 48);
    ctx.fillStyle = numberPlateFace;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#c4cbd0";
    ctx.stroke();

    let fontSize = 214;
    do {
      ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
      fontSize -= 4;
    } while (ctx.measureText(displayText).width > 1040 && fontSize > 120);
    ctx.fillStyle = "#626a71";
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 3;
    ctx.fillText(displayText, 600, 216);
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

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  return texture;
}

export function createYkGeongiWhiteTextTexture() {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 260;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.font = '900 180px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  ctx.lineWidth = 14;
  ctx.strokeStyle = "rgba(70, 8, 12, 0.72)";
  ctx.strokeText("YK건기", 512, 132);
  ctx.fillStyle = "#ffffff";
  ctx.fillText("YK건기", 512, 132);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  return texture;
}
