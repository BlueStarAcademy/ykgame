import * as THREE from "three";

function hash2(x: number, y: number) {
  return Math.abs(Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;
}

function fillNoisePixels(
  data: Uint8ClampedArray,
  size: number,
  palette: { r: number; g: number; b: number; spread: number },
  speckChance = 0.94,
) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = hash2(x, y);
      const n2 = hash2(x * 0.41, y * 0.37);
      const speck = hash2(x * 4.7, y * 3.9);
      const tone = (n + n2 * 0.55) / 1.55;
      let r = palette.r + (tone - 0.5) * palette.spread;
      let g = palette.g + (tone - 0.5) * palette.spread * 0.9;
      let b = palette.b + (tone - 0.5) * palette.spread * 0.7;
      if (speck > speckChance) {
        r += 18;
        g += 12;
        b += 6;
      } else if (speck < 0.06) {
        r -= 22;
        g -= 18;
        b -= 14;
      }
      const i = (y * size + x) * 4;
      data[i] = Math.min(255, Math.max(0, r));
      data[i + 1] = Math.min(255, Math.max(0, g));
      data[i + 2] = Math.min(255, Math.max(0, b));
      data[i + 3] = 255;
    }
  }
}

function createCanvasTexture(
  size: number,
  palette: { r: number; g: number; b: number; spread: number },
  repeat = 6,
  speckChance = 0.94,
) {
  if (typeof document === "undefined") {
    const data = new Uint8Array([palette.r, palette.g, palette.b, 255]);
    const texture = new THREE.DataTexture(data, 1, 1);
    texture.needsUpdate = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const data = new Uint8Array([palette.r, palette.g, palette.b, 255]);
    const texture = new THREE.DataTexture(data, 1, 1);
    texture.needsUpdate = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  const imageData = ctx.createImageData(size, size);
  fillNoisePixels(imageData.data, size, palette, speckChance);
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** 현장 바닥 흙·자갈 텍스처 */
export function createGroundDirtTexture() {
  return createCanvasTexture(256, { r: 198, g: 162, b: 108, spread: 52 }, 10, 0.93);
}

/** 버킷 안 흙 덩어리 텍스처 */
export function createBucketDirtTexture() {
  return createCanvasTexture(128, { r: 122, g: 86, b: 52, spread: 38 }, 2, 0.9);
}

/** 바위·자갈 조각 텍스처 */
export function createRockTexture() {
  return createCanvasTexture(128, { r: 142, g: 136, b: 128, spread: 34 }, 3, 0.88);
}

/** 현장 진입로·덤프 구역 자갈 텍스처 */
export function createGravelTexture() {
  return createCanvasTexture(256, { r: 168, g: 154, b: 132, spread: 48 }, 14, 0.9);
}

/** 압축 흙·타이어 자국 바닥 */
export function createCompactedDirtTexture() {
  return createCanvasTexture(256, { r: 176, g: 142, b: 98, spread: 36 }, 12, 0.91);
}

/** 안전 펜스·바리케이드 메탈 */
export function createPaintedMetalTexture() {
  return createCanvasTexture(128, { r: 210, g: 212, b: 218, spread: 28 }, 4, 0.92);
}
