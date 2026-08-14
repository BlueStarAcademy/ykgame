"use client";

import type { RefObject } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  YANMAR_MACHINE_COLORS as COLOR,
  YANMAR_MACHINE_MATERIALS as MATERIAL,
  YANMAR_MACHINE_RIG,
} from "./machineVisualTheme";
import { WorkLinkPin } from "./workEquipment/ykWorkGear";

const STEEL = {
  color: COLOR.steel,
  ...MATERIAL.steel,
} as const;
const BRIGHT_STEEL = {
  color: COLOR.steelBright,
  ...MATERIAL.steel,
} as const;

/** Soosan SB30E livery: safety-yellow shell over a black power cell. */
const SHELL_YELLOW = "#f2b70d";
const SHELL_YELLOW_DARK = "#c68f07";
const SHELL_BLACK = "#141719";

const PLATE_HALF_Z = 0.215;
const PLATE_THICKNESS = 0.048;
const PLATE_BEVEL = 0.008;
/**
 * True outer surface of the shell plate. ExtrudeGeometry adds bevelThickness
 * past `depth`, so decals must clear this or they sink into the plate.
 */
const PLATE_OUTER_Z = PLATE_HALF_Z + PLATE_THICKNESS / 2 + PLATE_BEVEL;

/** Mount bores — keep in sync with YANMAR_MACHINE_RIG.breakerArmPinLocal*. */
const BREAKER_ARM_PIN_LOCAL = {
  x: YANMAR_MACHINE_RIG.breakerArmPinLocalX,
  y: YANMAR_MACHINE_RIG.breakerArmPinLocalY,
} as const;
const BREAKER_LINK_PIN_LOCAL = { x: -0.304, y: 0.497 } as const;
/** Decorative third bore on the wing (not a structural pin). */
const BREAKER_IDLE_PIN_LOCAL = { x: 0.125, y: 0.231 } as const;

const BREAKER_TOOL_PROFILE = [
  new THREE.Vector2(0, -0.34),
  new THREE.Vector2(0.13, -0.34),
  new THREE.Vector2(0.118, -0.29),
  new THREE.Vector2(0.108, -0.22),
  new THREE.Vector2(0.103, 0.08),
  new THREE.Vector2(0.096, 0.15),
  new THREE.Vector2(0.08, 0.24),
  new THREE.Vector2(0.058, 0.32),
  new THREE.Vector2(0.039, 0.365),
  new THREE.Vector2(0.028, 0.382),
  new THREE.Vector2(0, 0.385),
];

/**
 * SB30E shell outline traced from the reference photo.
 * Local +X = arm pin end, -X = down the tool axis, +Y = mount-wing side.
 */
function createShellPlateGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0.181, -0.412);
  shape.lineTo(-1.22, -0.412);
  shape.lineTo(-1.22, -0.01);
  // Straight column edge up past the bolt cluster, then a swept shoulder
  // curving into the mount wing (tangent to the straight run at the bolts).
  shape.lineTo(-0.86, -0.01);
  shape.bezierCurveTo(-0.7, -0.01, -0.6, 0.26, -0.5, 0.5);
  shape.lineTo(-0.42, 0.575);
  shape.lineTo(-0.39, 0.59);
  shape.lineTo(0.013, 0.59);
  // Slanted top edge of the wing back down to the column
  shape.lineTo(0.219, 0.3);
  shape.lineTo(0.181, 0.02);
  shape.closePath();

  // Arched opening between wing and column — black power cell shows through
  const opening = new THREE.Path();
  opening.moveTo(-0.03, -0.1);
  opening.lineTo(-0.03, 0.13);
  opening.lineTo(-0.4, 0.13);
  opening.lineTo(-0.4, -0.1);
  opening.closePath();
  shape.holes.push(opening);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: PLATE_THICKNESS,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: PLATE_BEVEL,
    bevelSize: PLATE_BEVEL,
    bevelSegments: 1,
  });
  geometry.translate(0, 0, -PLATE_THICKNESS / 2);
  geometry.computeVertexNormals();
  return geometry;
}

const SHELL_PLATE_GEOMETRY = createShellPlateGeometry();

/**
 * Brand lockup decal: black "SOOSAN" wordmark over red "SB30E".
 * Drawn larger than real decals so the mark reads clearly in-game.
 */
function createBrandTexture(): THREE.CanvasTexture {
  const w = 768;
  const h = 384;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Slight outline so the mark stays readable on yellow paint.
  const strokeAndFill = (text: string, y: number, fill: string, size: number) => {
    ctx.font = `italic 900 ${size}px 'Arial Black', Impact, Arial, sans-serif`;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.lineWidth = Math.max(6, size * 0.06);
    ctx.strokeStyle = "rgba(255, 220, 80, 0.55)";
    ctx.strokeText(text, w / 2, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, w / 2, y);
  };

  strokeAndFill("SB30E", 118, "#c41010", 148);
  strokeAndFill("SOOSAN", 268, "#101010", 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function createDataPlateTexture(): THREE.CanvasTexture {
  const w = 192;
  const h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f2d21c";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  ctx.fillStyle = "#1a1a1a";
  for (let i = 0; i < 7; i += 1) {
    ctx.fillRect(20 + i * 22, 18, 9, h - 36);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createNoiseStickerTexture(): THREE.CanvasTexture {
  const w = 128;
  const h = 112;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#eef1f4";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#8b9096";
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, w - 4, h - 4);
  ctx.fillStyle = "#141414";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 54px Arial, sans-serif";
  ctx.fillText("114", w / 2, h / 2 + 4);
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.fillText("dB", w / 2, h - 18);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const HAS_DOM = typeof document !== "undefined";
const BRAND_TEXTURE = HAS_DOM ? createBrandTexture() : null;
const DATA_PLATE_TEXTURE = HAS_DOM ? createDataPlateTexture() : null;
const NOISE_STICKER_TEXTURE = HAS_DOM ? createNoiseStickerTexture() : null;

function ShellBolt({
  x,
  y,
  side,
  radius = 0.042,
}: {
  x: number;
  y: number;
  side: 1 | -1;
  radius?: number;
}) {
  return (
    <group position={[x, y, side * (PLATE_OUTER_Z + 0.014)]}>
      <mesh rotation={[Math.PI / 2, 0, Math.PI / 6]} castShadow>
        <cylinderGeometry args={[radius, radius, 0.028, 6]} />
        <meshStandardMaterial color="#1b1f22" roughness={0.42} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0, side * 0.016]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.46, radius * 0.46, 0.01, 14]} />
        <meshStandardMaterial {...BRIGHT_STEEL} />
      </mesh>
    </group>
  );
}

/** Black pin bore on the mount wing (arm / link / idle). */
function MountPinFace({
  x,
  y,
  side,
  radius,
}: {
  x: number;
  y: number;
  side: 1 | -1;
  radius: number;
}) {
  return (
    <group position={[x, y, side * (PLATE_OUTER_Z + 0.008)]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[radius, radius, 0.032, 26]} />
        <meshStandardMaterial color={SHELL_BLACK} roughness={0.36} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0, side * 0.014]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.6, radius * 0.6, 0.018, 22]} />
        <meshStandardMaterial color="#0a0c0d" roughness={0.6} metalness={0.3} />
      </mesh>
    </group>
  );
}

function ShellPlate({ side }: { side: 1 | -1 }) {
  const decalZ = side * (PLATE_OUTER_Z + 0.006);
  const decalRotation: [number, number, number] =
    side > 0 ? [0, 0, Math.PI] : [Math.PI, 0, Math.PI];

  return (
    <group>
      <mesh
        geometry={SHELL_PLATE_GEOMETRY}
        position={[0, 0, side * PLATE_HALF_Z]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={SHELL_YELLOW}
          roughness={0.32}
          metalness={0.28}
        />
      </mesh>

      <MountPinFace
        x={BREAKER_ARM_PIN_LOCAL.x}
        y={BREAKER_ARM_PIN_LOCAL.y}
        side={side}
        radius={0.078}
      />
      <MountPinFace
        x={BREAKER_LINK_PIN_LOCAL.x}
        y={BREAKER_LINK_PIN_LOCAL.y}
        side={side}
        radius={0.078}
      />
      <MountPinFace
        x={BREAKER_IDLE_PIN_LOCAL.x}
        y={BREAKER_IDLE_PIN_LOCAL.y}
        side={side}
        radius={0.078}
      />

      <ShellBolt x={0.047} y={-0.038} side={side} radius={0.04} />

      <group position={[-0.428, 0.328, side * (PLATE_OUTER_Z + 0.006)]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.02, 22]} />
          <meshStandardMaterial color="#c9ced3" roughness={0.42} metalness={0.65} />
        </mesh>
      </group>

      {BRAND_TEXTURE ? (
        <mesh position={[-0.18, 0.2, decalZ]} rotation={decalRotation}>
          <planeGeometry args={[0.48, 0.3]} />
          <meshBasicMaterial
            map={BRAND_TEXTURE}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ) : null}

      {NOISE_STICKER_TEXTURE ? (
        <mesh position={[0.02, -0.15, decalZ]} rotation={decalRotation}>
          <planeGeometry args={[0.15, 0.13]} />
          <meshBasicMaterial
            map={NOISE_STICKER_TEXTURE}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ) : null}

      {DATA_PLATE_TEXTURE ? (
        <mesh position={[-0.23, -0.307, decalZ]} rotation={decalRotation}>
          <planeGeometry args={[0.28, 0.187]} />
          <meshBasicMaterial
            map={DATA_PLATE_TEXTURE}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ) : null}

      {[
        [-0.913, -0.09],
        [-0.891, -0.307],
        [-1.048, -0.09],
        [-1.033, -0.307],
      ].map(([x, y]) => (
        <ShellBolt key={`${x}:${y}`} x={x} y={y} side={side} />
      ))}
    </group>
  );
}

/** Map a plate-local point into attachment space (scale + breakerRotationZ, arm pin at origin). */
function platePointToAttachment(x: number, y: number): { x: number; y: number } {
  const scale = YANMAR_MACHINE_RIG.breakerVisualScale;
  const rot = YANMAR_MACHINE_RIG.breakerRotationZ;
  const lx = (x - BREAKER_ARM_PIN_LOCAL.x) * scale;
  const ly = (y - BREAKER_ARM_PIN_LOCAL.y) * scale;
  return {
    x: Math.cos(rot) * lx - Math.sin(rot) * ly,
    y: Math.sin(rot) * lx + Math.cos(rot) * ly,
  };
}

/** Soosan SB30E — arm pins directly through the yellow wing holes. */
export function ExcavatorBreaker({
  chiselRef,
}: {
  chiselRef: RefObject<THREE.Group | null>;
}) {
  const scale = YANMAR_MACHINE_RIG.breakerVisualScale;
  const rot = YANMAR_MACHINE_RIG.breakerRotationZ;
  const linkAtt = platePointToAttachment(
    BREAKER_LINK_PIN_LOCAL.x,
    BREAKER_LINK_PIN_LOCAL.y,
  );
  // Shift so ARM_PIN lands on attachment origin after scale+rotation.
  const armScaledX = BREAKER_ARM_PIN_LOCAL.x * scale;
  const armScaledY = BREAKER_ARM_PIN_LOCAL.y * scale;
  const bodyX = -(Math.cos(rot) * armScaledX - Math.sin(rot) * armScaledY);
  const bodyY = -(Math.sin(rot) * armScaledX + Math.cos(rot) * armScaledY);

  return (
    <group>
      {/* Steel pins through the yellow wing — this is the arm connection. */}
      <WorkLinkPin x={0} y={0} radius={0.085} width={0.52} plain />
      <WorkLinkPin x={linkAtt.x} y={linkAtt.y} radius={0.08} width={0.5} plain />

      <group position={[bodyX, bodyY, 0]} rotation={[0, 0, rot]} scale={scale}>
        {/*
          No solid fill between the wing plates — the arm ears must sit in
          the gap and be clamped by the two black pin bores.
        */}

        {/* Black power cell down the column, seen through the opening */}
        <RoundedBox
          args={[1.2, 0.47, 0.34]}
          radius={0.035}
          smoothness={5}
          position={[-0.62, -0.105, 0]}
          castShadow
        >
          <meshStandardMaterial color={SHELL_BLACK} roughness={0.4} metalness={0.45} />
        </RoundedBox>

        {/* Narrow yellow web below the pin zone (does not block the arm gap) */}
        <RoundedBox
          args={[0.55, 0.2, 0.3]}
          radius={0.04}
          smoothness={4}
          position={[-0.35, -0.05, 0]}
          castShadow
        >
          <meshStandardMaterial
            color={SHELL_YELLOW_DARK}
            roughness={0.38}
            metalness={0.28}
          />
        </RoundedBox>

        <mesh position={[-0.304, 0.093, 0.19]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.026, 0.026, 0.05, 12]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>

        <RoundedBox
          args={[0.16, 0.24, 0.3]}
          radius={0.026}
          smoothness={4}
          position={[0.26, -0.21, 0]}
          castShadow
        >
          <meshStandardMaterial color={SHELL_BLACK} roughness={0.36} metalness={0.5} />
        </RoundedBox>

        {([-1, 1] as const).map((side) => (
          <ShellPlate key={side} side={side} />
        ))}

        <RoundedBox
          args={[0.34, 0.33, 0.4]}
          radius={0.03}
          smoothness={5}
          position={[-1.39, -0.17, 0]}
          castShadow
        >
          <meshStandardMaterial color={SHELL_BLACK} roughness={0.42} metalness={0.44} />
        </RoundedBox>

        <group ref={chiselRef}>
          <mesh
            position={[
              YANMAR_MACHINE_RIG.breakerTipLocalX + 0.385,
              YANMAR_MACHINE_RIG.breakerTipLocalY,
              0,
            ]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <latheGeometry args={[BREAKER_TOOL_PROFILE, 32]} />
            <meshStandardMaterial color="#2a2e32" roughness={0.35} metalness={0.7} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
