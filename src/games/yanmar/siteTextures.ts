import * as THREE from "three";

export const PREMIUM_SITE_TEXTURES = {
  groundAlbedo: "/images/yanmar/2d/site/ground-albedo.webp",
  groundNormal: "/images/yanmar/2d/site/ground-normal.webp",
  groundRoughness: "/images/yanmar/2d/site/ground-roughness.webp",
  asphaltAlbedo: "/images/yanmar/2d/site/asphalt-albedo.webp",
  asphaltNormal: "/images/yanmar/2d/site/asphalt-normal.webp",
  asphaltRoughness: "/images/yanmar/2d/site/asphalt-roughness.webp",
  backdrop: "/images/yanmar/2d/site/premium-skyline-backdrop.png",
  sportsMeetBackdrop: "/images/yanmar/2d/site/sports-meet-skyline-backdrop.png",
} as const;

export function configureSiteTexture(
  texture: THREE.Texture,
  repeatX: number,
  repeatY = repeatX,
  color = false,
) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  texture.colorSpace = color
    ? THREE.SRGBColorSpace
    : THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}
