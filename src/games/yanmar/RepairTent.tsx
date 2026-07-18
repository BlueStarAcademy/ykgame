"use client";

import { useLayoutEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { YK_GEONGI_LOGO } from "@/lib/brand-assets";
import { configureYkGeongiLogoTexture } from "./machineVisualTheme";
import { REPAIR_TENT } from "./gearCatalog";

const COLORS = {
  metal: "#c5c9ce",
  metalDark: "#9aa1a8",
  metalLight: "#d8dce0",
  trimBlue: "#1e6bb8",
  door: "#b8bec6",
  doorFrame: "#8e959e",
  officeTile: "#a8adb4",
  officeTileDark: "#8a9098",
  glass: "#9ec4d8",
  roof: "#b0b6bd",
  apron: "#9a9e98",
  lamp: "#1a1d22",
  lampHead: "#2a2e35",
} as const;

function createCorrugatedMetalTexture() {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#c8ccd1";
  ctx.fillRect(0, 0, 256, 128);
  for (let y = 0; y < 128; y += 8) {
    const grad = ctx.createLinearGradient(0, y, 0, y + 8);
    grad.addColorStop(0, "#d6dae0");
    grad.addColorStop(0.45, "#b4bac2");
    grad.addColorStop(1, "#cfd3d8");
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, 256, 8);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 4);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** Industrial YK repair shop — corrugated bays, office wing, rooftop sign. */
export function RepairTent({
  x = REPAIR_TENT.x,
  z = REPAIR_TENT.z,
  radius = REPAIR_TENT.radius,
  rotationY = REPAIR_TENT.rotationY,
}: {
  x?: number;
  z?: number;
  radius?: number;
  rotationY?: number;
}) {
  const signTexture = useLoader(THREE.TextureLoader, YK_GEONGI_LOGO.black);
  const metalTexture = useMemo(() => createCorrugatedMetalTexture(), []);
  useLayoutEffect(() => {
    configureYkGeongiLogoTexture(signTexture);
  }, [signTexture]);

  const bayCount = 5;
  const bayWidth = 3.6;
  const bayGap = 0.22;
  const bayHeight = 4.2;
  const bayDepth = 0.12;
  const shopWidth = bayCount * bayWidth + (bayCount - 1) * bayGap;
  const officeWidth = 5.2;
  const totalWidth = shopWidth + officeWidth + 0.35;
  const depth = 10;
  const wallHeightLow = 5.2;
  const wallHeightHigh = 8.4;
  const roofOverhang = 0.45;

  const bayCenters = useMemo(() => {
    const startX = -totalWidth / 2 + officeWidth + bayWidth / 2 + 0.2;
    return Array.from({ length: bayCount }, (_, i) => startX + i * (bayWidth + bayGap));
  }, [totalWidth, officeWidth, bayWidth, bayGap, bayCount]);

  const roofPitch = Math.atan2(wallHeightHigh - wallHeightLow, shopWidth + officeWidth * 0.15);

  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      {/* Interaction apron ring */}
      <mesh position={[0, 0.03, depth / 2 + 3]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.45, radius, 64]} />
        <meshBasicMaterial color="#c4a35a" transparent opacity={0.32} />
      </mesh>

      {/* Concrete apron */}
      <mesh position={[0, 0.02, depth / 2 + 2.2]} receiveShadow>
        <boxGeometry args={[totalWidth + 4, 0.04, 8]} />
        <meshStandardMaterial color={COLORS.apron} roughness={0.95} />
      </mesh>

      {/* Main shell floor slab */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[totalWidth + 0.4, 0.08, depth + 0.4]} />
        <meshStandardMaterial color="#8f938c" roughness={0.92} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, wallHeightLow / 2 + 0.8, -depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[totalWidth, wallHeightHigh - 0.6, 0.28]} />
        <meshStandardMaterial
          color={COLORS.metalDark}
          map={metalTexture ?? undefined}
          roughness={0.78}
          metalness={0.22}
        />
      </mesh>

      {/* Side walls */}
      <mesh
        position={[-totalWidth / 2, (wallHeightLow + wallHeightHigh) / 4, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[0.28, (wallHeightLow + wallHeightHigh) / 2, depth]} />
        <meshStandardMaterial color={COLORS.metal} roughness={0.8} metalness={0.18} />
      </mesh>
      <mesh
        position={[totalWidth / 2, (wallHeightLow + wallHeightHigh) / 4 + 0.6, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[0.28, (wallHeightLow + wallHeightHigh) / 2 + 1.2, depth]} />
        <meshStandardMaterial color={COLORS.metal} roughness={0.8} metalness={0.18} />
      </mesh>

      {/* Office wing (left, lower flat section) */}
      <group position={[-totalWidth / 2 + officeWidth / 2, 0, 0.15]}>
        <mesh position={[0, wallHeightLow / 2 - 0.15, 0]} castShadow receiveShadow>
          <boxGeometry args={[officeWidth, wallHeightLow - 0.3, depth - 0.3]} />
          <meshStandardMaterial color={COLORS.officeTile} roughness={0.88} />
        </mesh>
        {/* Tile grid accents */}
        {[-1.2, 0, 1.2].map((tx) => (
          <mesh key={tx} position={[tx, 2.4, depth / 2 - 0.12]}>
            <boxGeometry args={[1.35, 2.8, 0.06]} />
            <meshStandardMaterial color={COLORS.officeTileDark} roughness={0.9} />
          </mesh>
        ))}
        {/* Glass door */}
        <mesh position={[0.15, 1.55, depth / 2 - 0.05]}>
          <boxGeometry args={[1.35, 2.7, 0.08]} />
          <meshStandardMaterial
            color={COLORS.glass}
            transparent
            opacity={0.55}
            roughness={0.15}
            metalness={0.35}
          />
        </mesh>
        <mesh position={[0.15, 1.55, depth / 2 - 0.02]}>
          <boxGeometry args={[1.45, 2.8, 0.04]} />
          <meshStandardMaterial color={COLORS.doorFrame} roughness={0.7} metalness={0.4} />
        </mesh>
        {/* High windows */}
        {[-1.35, 1.35].map((wx) => (
          <mesh key={wx} position={[wx, 3.85, depth / 2 - 0.04]}>
            <boxGeometry args={[1.1, 0.7, 0.06]} />
            <meshStandardMaterial
              color={COLORS.glass}
              transparent
              opacity={0.5}
              roughness={0.12}
              metalness={0.4}
            />
          </mesh>
        ))}
        {/* Flat office roof */}
        <mesh position={[0, wallHeightLow - 0.05, 0]} castShadow>
          <boxGeometry args={[officeWidth + 0.3, 0.18, depth + 0.2]} />
          <meshStandardMaterial color={COLORS.roof} roughness={0.85} metalness={0.15} />
        </mesh>
      </group>

      {/* Main corrugated facade (behind bay doors) */}
      <mesh
        position={[officeWidth / 2 - 0.1, wallHeightLow / 2 + 0.9, depth / 2 - 0.35]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[shopWidth + 0.6, wallHeightHigh - 1.2, 0.22]} />
        <meshStandardMaterial
          color={COLORS.metalLight}
          map={metalTexture ?? undefined}
          roughness={0.72}
          metalness={0.28}
        />
      </mesh>

      {/* Blue horizontal trim above bay doors */}
      <mesh position={[officeWidth / 2 - 0.1, bayHeight + 0.55, depth / 2 - 0.18]}>
        <boxGeometry args={[shopWidth + 0.8, 0.22, 0.55]} />
        <meshStandardMaterial color={COLORS.trimBlue} roughness={0.45} metalness={0.35} />
      </mesh>

      {/* Five service bay doors + gooseneck lamps */}
      {bayCenters.map((bx, i) => (
        <group key={i} position={[bx, 0, depth / 2 - 0.08]}>
          <mesh position={[0, bayHeight / 2, 0]} castShadow>
            <boxGeometry args={[bayWidth, bayHeight, bayDepth]} />
            <meshStandardMaterial color={COLORS.door} roughness={0.65} metalness={0.45} />
          </mesh>
          {/* Door frame */}
          <mesh position={[0, bayHeight / 2, 0.04]}>
            <boxGeometry args={[bayWidth + 0.12, bayHeight + 0.1, 0.04]} />
            <meshStandardMaterial color={COLORS.doorFrame} roughness={0.7} metalness={0.3} />
          </mesh>
          {/* Horizontal door ribs */}
          {[0.7, 1.5, 2.3, 3.1].map((ry) => (
            <mesh key={ry} position={[0, ry, 0.07]}>
              <boxGeometry args={[bayWidth - 0.15, 0.06, 0.03]} />
              <meshStandardMaterial color="#a0a6ae" roughness={0.6} metalness={0.5} />
            </mesh>
          ))}
          {/* Gooseneck lamp */}
          <group position={[0, bayHeight + 0.95, 0.15]}>
            <mesh position={[0, 0.15, -0.25]}>
              <cylinderGeometry args={[0.04, 0.04, 0.55, 6]} />
              <meshStandardMaterial color={COLORS.lamp} roughness={0.55} metalness={0.6} />
            </mesh>
            <mesh position={[0, 0.35, 0.05]} rotation={[0.7, 0, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 0.45, 6]} />
              <meshStandardMaterial color={COLORS.lamp} roughness={0.55} metalness={0.6} />
            </mesh>
            <mesh position={[0, 0.18, 0.28]} rotation={[1.1, 0, 0]}>
              <boxGeometry args={[0.28, 0.12, 0.22]} />
              <meshStandardMaterial color={COLORS.lampHead} roughness={0.4} metalness={0.7} />
            </mesh>
          </group>
        </group>
      ))}

      {/* Asymmetrical sloping roof (low left → high right) */}
      <group
        position={[0.4, (wallHeightLow + wallHeightHigh) / 2 + 0.15, 0]}
        rotation={[0, 0, roofPitch]}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[totalWidth + roofOverhang * 2, 0.22, depth + roofOverhang]} />
          <meshStandardMaterial color={COLORS.roof} roughness={0.82} metalness={0.2} />
        </mesh>
      </group>

      {/* Rooftop YK건기 sign on the tall (right) end */}
      <group position={[totalWidth / 2 - 4.2, wallHeightHigh - 0.35, depth / 2 - 0.55]}>
        <mesh position={[0, 0, -0.08]}>
          <boxGeometry args={[7.2, 1.65, 0.12]} />
          <meshStandardMaterial color="#d8dce0" roughness={0.55} metalness={0.25} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[6.4, 6.4 / YK_GEONGI_LOGO.aspect]} />
          <meshBasicMaterial
            map={signTexture}
            transparent
            alphaTest={0.1}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

export function isInRepairTentRange(
  posX: number,
  posZ: number,
  tentX = REPAIR_TENT.x,
  tentZ = REPAIR_TENT.z,
  radius = REPAIR_TENT.radius,
) {
  const dx = posX - tentX;
  const dz = posZ - tentZ;
  return dx * dx + dz * dz <= radius * radius;
}
