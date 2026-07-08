"use client";

/* eslint-disable react-hooks/refs */

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import type { AuxiliaryControlState, ExcavatorControlState, ControlMask } from "./controls";
import {
  applyControls,
  canLoadBucket as isBucketCurled,
  filterInput,
  type HydraulicVelocity,
} from "./controls";
import { ExcavatorBucket } from "./ExcavatorBucket";
import {
  createTerrain,
  digAt,
  getActiveDigZones,
  isInDigZone,
  isInDumpZone,
  sampleHeight,
  updateDigZoneRespawns,
  type TerrainData,
  DUMP_ZONE,
} from "./terrain";
import {
  getBucketBodyContactWorld,
  getBucketScraperContactWorld,
  getBucketTipWorld,
  type DigFeedback,
} from "./bucket";
import type { DiggingScoreState } from "./scoring";
import type { GameMode, TutorialStep } from "./tutorial";
import type { YanmarEquipmentStats } from "./equipment";

export interface ExcavatorSimState {
  swing: number;
  boom: number;
  arm: number;
  bucket: number;
  posX: number;
  posZ: number;
  heading: number;
  bucketLoad: number;
}

export interface DumpScorePopup {
  id: number;
  score: number;
  critical: boolean;
  rewardText?: string;
  x: number;
  y: number;
  z: number;
}

interface ExcavatorSceneProps {
  inputRef: React.RefObject<ExcavatorControlState>;
  simRef: React.MutableRefObject<ExcavatorSimState>;
  velRef: React.MutableRefObject<HydraulicVelocity>;
  terrainRef: React.MutableRefObject<TerrainData>;
  scoreRef: React.MutableRefObject<DiggingScoreState>;
  modeRef: React.RefObject<GameMode>;
  equipmentStatsRef: React.RefObject<YanmarEquipmentStats>;
  allowedRef: React.RefObject<ControlMask>;
  auxiliaryRef: React.RefObject<AuxiliaryControlState>;
  tutorialStepRef: React.RefObject<TutorialStep | null>;
  tutorialDumpRef: React.MutableRefObject<number>;
  digFeedbackRef: React.MutableRefObject<DigFeedback>;
  onProgress: (dumped: number, progress: number) => void;
  onDumpScore: (popup: Omit<DumpScorePopup, "id">) => void;
  onSimTick: () => void;
  scorePopups: DumpScorePopup[];
  cameraMode: CameraMode;
  layoutPortrait: boolean;
}

export type CameraMode = 1 | 2 | 3;

function TerrainMesh({ terrainRef }: { terrainRef: React.MutableRefObject<TerrainData> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geomRef = useRef<THREE.PlaneGeometry | null>(null);
  const colorsRef = useRef<Float32Array | null>(null);

  const geometry = useMemo(() => {
    const t = terrainRef.current;
    const geo = new THREE.PlaneGeometry(
      t.gridSize * t.cellSize,
      t.gridSize * t.cellSize,
      t.gridSize - 1,
      t.gridSize - 1,
    );
    geo.rotateX(-Math.PI / 2);
    const count = geo.attributes.position.count;
    colorsRef.current = new Float32Array(count * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(colorsRef.current, 3));
    geomRef.current = geo;
    return geo;
  }, [terrainRef]);

  useFrame(() => {
    const geo = geomRef.current;
    const t = terrainRef.current;
    const colors = colorsRef.current;
    if (!geo || !colors) return;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const c0 = new THREE.Color("#d7b780");
    const cDug = new THREE.Color("#8f6137");
    const cMound = new THREE.Color("#e4c07f");

    for (let gz = 0; gz < t.gridSize; gz++) {
      for (let gx = 0; gx < t.gridSize; gx++) {
        const idx = gz * t.gridSize + gx;
        const vi = idx;
        const h = t.heights[idx];
        pos.setY(vi, h);

        const dug = t.baseHeights[idx] - h;
        const col = dug > 0.08 ? cDug : h > 1.3 ? cMound : c0;
        colors[vi * 3] = col.r;
        colors[vi * 3 + 1] = col.g;
        colors[vi * 3 + 2] = col.b;
      }
    }
    pos.needsUpdate = true;
    (geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[
        terrainRef.current.originX + (terrainRef.current.gridSize * terrainRef.current.cellSize) / 2,
        0,
        terrainRef.current.originZ + (terrainRef.current.gridSize * terrainRef.current.cellSize) / 2,
      ]}
    >
      <meshStandardMaterial vertexColors roughness={0.78} metalness={0.02} />
    </mesh>
  );
}

function LinkPin({
  x,
  y,
  z = 0,
  radius = 0.18,
  width = 0.5,
}: {
  x: number;
  y: number;
  z?: number;
  radius?: number;
  width?: number;
}) {
  return (
    <group position={[x, y, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, width, 24]} />
        <meshStandardMaterial color="#1f252c" roughness={0.34} metalness={0.45} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh
          key={side}
          position={[0, 0, side * (width / 2 + 0.012)]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[radius * 0.72, radius * 0.72, 0.035, 24]} />
          <meshStandardMaterial color="#d8dee5" roughness={0.26} metalness={0.58} />
        </mesh>
      ))}
      <mesh position={[0, 0, width / 2 + 0.034]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.28, radius * 0.28, 0.03, 16]} />
        <meshStandardMaterial color="#6d747d" roughness={0.22} metalness={0.7} />
      </mesh>
    </group>
  );
}

const YANMAR_LOGO_ASPECT = 512 / 62;
const YK_LABEL_ASPECT = 512 / 160;
const YANMAR_LOGO_WIDTH = 1.24;
const YK_LOGO_WIDTH = 0.96;

function configureDecalTexture(texture: THREE.Texture, anisotropy = 16) {
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = anisotropy;
  texture.colorSpace = THREE.SRGBColorSpace;
}

function logoHeightForWidth(width: number, aspect: number) {
  return width / aspect;
}

function clampControl(value: number, min = -1, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function HydraulicCylinder({
  x,
  y,
  length,
  angle = 0,
}: {
  x: number;
  y: number;
  length: number;
  angle?: number;
}) {
  return (
    <group position={[x, y, 0]} rotation={[0, 0, angle]}>
      <mesh position={[-length * 0.12, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <capsuleGeometry args={[0.09, length * 0.52, 8, 16]} />
        <meshStandardMaterial color="#151a20" roughness={0.28} metalness={0.42} />
      </mesh>
      <mesh position={[length * 0.22, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <capsuleGeometry args={[0.035, length * 0.48, 6, 12]} />
        <meshStandardMaterial color="#dfe7ee" roughness={0.18} metalness={0.78} />
      </mesh>
      {[-length * 0.42, length * 0.48].map((pinX) => (
        <mesh key={pinX} position={[pinX, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.42, 18]} />
          <meshStandardMaterial color="#252c34" roughness={0.3} metalness={0.45} />
        </mesh>
      ))}
    </group>
  );
}

function RedLinkPanel({
  length,
  height,
  sideDepth,
  logo,
  logoWidth = 1.2,
  logoHeight = 0.24,
  logoX,
  coreStartRatio = 0.04,
  rootReliefScale = 1,
}: {
  length: number;
  height: number;
  sideDepth: number;
  logo?: THREE.Texture;
  logoWidth?: number;
  logoHeight?: number;
  logoX?: number;
  coreStartRatio?: number;
  rootReliefScale?: number;
}) {
  const coreEndRatio = 0.96;
  const coreLength = length * Math.max(0.1, coreEndRatio - coreStartRatio);
  const coreX = length * ((coreStartRatio + coreEndRatio) / 2);

  return (
    <>
      {[1, -1].map((side) => (
        <group key={side} position={[0, 0, side * sideDepth]}>
          <mesh position={[length / 2, 0, 0]}>
            <boxGeometry args={[length, height, 0.08]} />
            <meshStandardMaterial color="#e11f1f" roughness={0.34} metalness={0.18} />
          </mesh>
          <mesh position={[length / 2, height * 0.39, 0.052]}>
            <boxGeometry args={[length * 0.86, height * 0.09, 0.022]} />
            <meshStandardMaterial color="#ff7a5f" roughness={0.26} metalness={0.2} />
          </mesh>
          <mesh position={[length / 2, -height * 0.4, 0.052]}>
            <boxGeometry args={[length * 0.78, height * 0.12, 0.024]} />
            <meshStandardMaterial color="#7d1111" roughness={0.5} metalness={0.08} />
          </mesh>
          <mesh position={[length * 0.18, height * 0.05, 0.052]} rotation={[0, 0, -0.34]}>
            <boxGeometry args={[length * 0.18 * rootReliefScale, height * 0.16 * rootReliefScale, 0.028]} />
            <meshStandardMaterial color="#11151a" roughness={0.65} metalness={0.1} />
          </mesh>
          <mesh position={[length * 0.52, 0, 0.058]}>
            <boxGeometry args={[length * 0.72, 0.018, 0.018]} />
            <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.18} />
          </mesh>
          {logo && logoX != null && (
            <mesh position={[logoX, 0.04, side * 0.056]} scale={[-1, 1, 1]}>
              <planeGeometry args={[logoWidth, logoHeight]} />
              <meshBasicMaterial
                map={logo}
                transparent
                toneMapped={false}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
        </group>
      ))}
      <mesh position={[coreX, 0, 0]}>
        <boxGeometry args={[coreLength, height * 0.62, sideDepth * 1.45]} />
        <meshStandardMaterial color="#aa1515" roughness={0.44} metalness={0.14} />
      </mesh>
    </>
  );
}

function createLabelTexture(text: string) {
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
  ctx.font = '900 76px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 10;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.96)";
  ctx.strokeText(text, 256, 80);
  ctx.fillStyle = "#0b6edc";
  ctx.fillText(text.slice(0, 2), 184, 80);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text.slice(2), 310, 80);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  configureDecalTexture(texture);
  return texture;
}

function CockpitJoystick({
  side,
  inputRef,
}: {
  side: "left" | "right";
  inputRef: React.RefObject<ExcavatorControlState>;
}) {
  const stickRef = useRef<THREE.Group>(null);
  const sideSign = side === "left" ? 1 : -1;

  useFrame(() => {
    const stick = stickRef.current;
    const input = inputRef?.current?.[side];
    if (!stick || !input) return;
    stick.rotation.x = clampControl(input.y) * 0.26;
    stick.rotation.z = clampControl(input.x) * sideSign * 0.22;
  });

  return (
    <group position={[-0.44, 0.28, side === "left" ? 1.2 : -1.2]} scale={1.22}>
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.28, 0.36, 0.11, 28]} />
        <meshStandardMaterial color="#11171e" roughness={0.54} metalness={0.12} />
      </mesh>
      {[0, 1, 2, 3].map((idx) => (
        <mesh key={idx} position={[0, 0.12 + idx * 0.055, 0]}>
          <cylinderGeometry args={[0.31 - idx * 0.04, 0.27 - idx * 0.035, 0.058, 28]} />
          <meshStandardMaterial color={idx % 2 ? "#252c35" : "#0b0f14"} roughness={0.62} />
        </mesh>
      ))}
      <group ref={stickRef} position={[0, 0.25, 0]}>
        <mesh position={[0, 0.4, 0]}>
          <capsuleGeometry args={[0.11, 0.58, 8, 18]} />
          <meshStandardMaterial color="#232b35" roughness={0.42} metalness={0.18} />
        </mesh>
        <mesh position={[0, 0.78, 0]}>
          <capsuleGeometry args={[0.18, 0.3, 8, 20]} />
          <meshStandardMaterial color="#3f4854" roughness={0.38} metalness={0.16} />
        </mesh>
        {side === "right" ? (
          <mesh position={[0.1, 0.92, 0.09]}>
            <sphereGeometry args={[0.055, 16, 10]} />
            <meshStandardMaterial color="#e5ded2" roughness={0.28} metalness={0.2} />
          </mesh>
        ) : null}
      </group>
    </group>
  );
}

function CockpitTravelLever({
  side,
  inputRef,
}: {
  side: "left" | "right";
  inputRef: React.RefObject<ExcavatorControlState>;
}) {
  const leverRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const lever = leverRef.current;
    const value = inputRef?.current?.travel[side] ?? 0;
    if (!lever) return;
    lever.rotation.z = clampControl(value) * 0.25;
  });

  return (
    <group ref={leverRef} position={[0.18, 0.22, side === "left" ? 0.22 : -0.22]} scale={1.2}>
      <mesh position={[0, 0.22, 0]}>
        <capsuleGeometry args={[0.045, 0.5, 6, 12]} />
        <meshStandardMaterial color="#151b23" roughness={0.34} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.56, 0]}>
        <boxGeometry args={[0.2, 0.15, 0.17]} />
        <meshStandardMaterial color="#343c47" roughness={0.34} metalness={0.22} />
      </mesh>
    </group>
  );
}

function MachineCockpit({
  inputRef,
  auxiliaryRef,
}: {
  inputRef: React.RefObject<ExcavatorControlState>;
  auxiliaryRef: React.RefObject<AuxiliaryControlState>;
}) {
  const safetyRef = useRef<THREE.Group>(null);
  const hydraulicRef = useRef<THREE.Group>(null);
  const pedalRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const aux = auxiliaryRef.current;
    if (safetyRef.current) safetyRef.current.rotation.z = aux?.safetyLocked ? -0.32 : 0.18;
    if (hydraulicRef.current) hydraulicRef.current.rotation.z = aux?.highSpeed ? -0.22 : 0.16;
    if (pedalRef.current) pedalRef.current.rotation.x = (aux?.boomSwing ?? 0) * 0.16;
  });

  return (
    <group position={[-2.42, 0.82, 0]} rotation={[0, 0, -0.035]} scale={1.42}>
      <mesh position={[-0.12, -0.12, 0]}>
        <boxGeometry args={[1.92, 0.16, 3.42]} />
        <meshStandardMaterial color="#d92323" roughness={0.44} metalness={0.1} />
      </mesh>
      <mesh position={[-0.02, 0.02, 0]}>
        <boxGeometry args={[1.42, 0.14, 2.42]} />
        <meshStandardMaterial color="#10161d" roughness={0.62} metalness={0.08} />
      </mesh>
      <mesh position={[-0.66, 0.08, 0]}>
        <boxGeometry args={[0.88, 0.18, 1.42]} />
        <meshStandardMaterial color="#9aa5af" roughness={0.48} metalness={0.12} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[-0.36, 0.24, side * 1.18]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.84, 0.34, 0.72]} />
            <meshStandardMaterial color="#909ba6" roughness={0.5} metalness={0.12} />
          </mesh>
          <mesh position={[-0.36, 0.26, side * 0.03]}>
            <boxGeometry args={[0.52, 0.15, 0.62]} />
            <meshStandardMaterial color="#222a33" roughness={0.56} metalness={0.12} />
          </mesh>
          <mesh position={[0.22, 0.09, side * -0.25]}>
            <sphereGeometry args={[0.055, 16, 10]} />
            <meshStandardMaterial color="#111820" roughness={0.35} metalness={0.35} />
          </mesh>
        </group>
      ))}
      <mesh position={[0.42, 0.34, 0]}>
        <boxGeometry args={[0.55, 0.48, 1.34]} />
        <meshStandardMaterial color="#d92323" roughness={0.42} metalness={0.1} />
      </mesh>
      <mesh position={[0.25, 0.2, 0]}>
        <boxGeometry args={[0.16, 0.28, 1.08]} />
        <meshStandardMaterial color="#111820" roughness={0.55} metalness={0.14} />
      </mesh>
      {[-0.32, -0.1, 0.12, 0.34].map((z, idx) => (
        <mesh key={z} position={[0.12 + (idx % 2) * 0.1, 0.62, z]}>
          <boxGeometry args={[0.13, 0.1, 0.13]} />
          <meshStandardMaterial
            color={idx === 0 ? "#45c331" : idx === 2 ? "#aeb8c4" : "#252d36"}
            roughness={0.34}
            metalness={0.18}
          />
        </mesh>
      ))}
      <CockpitJoystick side="left" inputRef={inputRef} />
      <CockpitJoystick side="right" inputRef={inputRef} />
      <CockpitTravelLever side="left" inputRef={inputRef} />
      <CockpitTravelLever side="right" inputRef={inputRef} />
      <group ref={safetyRef} position={[-0.08, 0.32, 0.72]} scale={1.18}>
        <mesh position={[0, 0.2, 0]}>
          <capsuleGeometry args={[0.035, 0.34, 6, 12]} />
          <meshStandardMaterial color="#141a21" roughness={0.38} metalness={0.32} />
        </mesh>
        <mesh position={[0, 0.43, 0]}>
          <capsuleGeometry args={[0.08, 0.13, 8, 16]} />
          <meshStandardMaterial color="#ef3127" roughness={0.34} metalness={0.16} />
        </mesh>
      </group>
      <group ref={hydraulicRef} position={[0.28, 0.38, -0.74]} scale={1.18}>
        <mesh position={[0, 0.2, 0]}>
          <capsuleGeometry args={[0.03, 0.34, 6, 12]} />
          <meshStandardMaterial color="#141a21" roughness={0.38} metalness={0.32} />
        </mesh>
        <mesh position={[0, 0.43, 0]}>
          <sphereGeometry args={[0.08, 18, 12]} />
          <meshStandardMaterial color="#1f2730" roughness={0.36} metalness={0.26} />
        </mesh>
      </group>
      <group ref={pedalRef} position={[-0.04, 0.06, -0.58]} scale={1.18}>
        <mesh>
          <boxGeometry args={[0.18, 0.08, 0.34]} />
          <meshStandardMaterial color="#202832" roughness={0.5} metalness={0.18} />
        </mesh>
      </group>
    </group>
  );
}

function UpperStructureConnector() {
  return (
    <group>
      <mesh position={[-0.72, 0.86, 0]}>
        <boxGeometry args={[2.95, 0.34, 2.18]} />
        <meshStandardMaterial color="#d92323" roughness={0.42} metalness={0.12} />
      </mesh>
      <mesh position={[-0.64, 1.04, 0]}>
        <boxGeometry args={[2.48, 0.18, 1.58]} />
        <meshStandardMaterial color="#1b222b" roughness={0.58} metalness={0.16} />
      </mesh>
      <mesh position={[0.22, 1.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.72, 0.82, 1.55, 40]} />
        <meshStandardMaterial color="#111820" roughness={0.38} metalness={0.42} />
      </mesh>
      <mesh position={[0.5, 1.25, 0]}>
        <boxGeometry args={[0.9, 0.42, 1.15]} />
        <meshStandardMaterial color="#b91c1c" roughness={0.4} metalness={0.14} />
      </mesh>
      <mesh position={[0.75, 1.16, 0]}>
        <boxGeometry args={[0.42, 0.78, 0.72]} />
        <meshStandardMaterial color="#242c36" roughness={0.42} metalness={0.28} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[-0.54, 1.1, side * 0.86]}>
          <mesh rotation={[0, 0, -0.12]}>
            <boxGeometry args={[1.82, 0.22, 0.12]} />
            <meshStandardMaterial color="#ef3b2f" roughness={0.36} metalness={0.12} />
          </mesh>
          <mesh position={[0.92, 0.08, 0]}>
            <boxGeometry args={[0.36, 0.62, 0.16]} />
            <meshStandardMaterial color="#2b3139" roughness={0.4} metalness={0.28} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CabWindowMaterial() {
  return (
    <meshStandardMaterial
      color="#122a31"
      roughness={0.12}
      metalness={0.14}
      transparent
      opacity={0.8}
    />
  );
}

function TankTrack({ side }: { side: 1 | -1 }) {
  const rollers = [-1.62, -1.08, -0.54, 0, 0.54, 1.08, 1.62];
  const treadPads = Array.from({ length: 16 }, (_, index) => -1.88 + index * 0.25);

  return (
    <group position={[0, 0, side * 0.82]}>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[4.24, 0.54, 0.52]} />
        <meshStandardMaterial color="#11191f" roughness={0.68} metalness={0.22} />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[4.02, 0.32, 0.58]} />
        <meshStandardMaterial color="#26333b" roughness={0.48} metalness={0.28} />
      </mesh>
      <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[3.82, 0.2, 0.58]} />
        <meshStandardMaterial color="#070b0e" roughness={0.74} metalness={0.16} />
      </mesh>

      {[-1.88, 1.88].map((x) => (
        <mesh key={`sprocket-${x}`} position={[x, 0.03, side * 0.025]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.11, 28]} />
          <meshStandardMaterial color="#0a0f12" roughness={0.48} metalness={0.34} />
        </mesh>
      ))}
      {rollers.map((x) => (
        <group key={x} position={[x, -0.06, side * 0.04]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.12, 24]} />
            <meshStandardMaterial color="#182229" roughness={0.42} metalness={0.36} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.105, 0.105, 0.135, 20]} />
            <meshStandardMaterial color="#55636c" roughness={0.28} metalness={0.52} />
          </mesh>
        </group>
      ))}

      {treadPads.map((x, index) => (
        <mesh key={`lower-pad-${index}`} position={[x, -0.37, side * 0.02]}>
          <boxGeometry args={[0.16, 0.08, 0.66]} />
          <meshStandardMaterial color="#0b1115" roughness={0.66} metalness={0.22} />
        </mesh>
      ))}
      {treadPads.slice(1, -1).map((x, index) => (
        <mesh key={`upper-pad-${index}`} position={[x, 0.34, side * 0.02]}>
          <boxGeometry args={[0.15, 0.06, 0.62]} />
          <meshStandardMaterial color="#1b2730" roughness={0.52} metalness={0.26} />
        </mesh>
      ))}
      {[-1, 1].map((end) =>
        [-0.18, 0.02, 0.22].map((y) => (
          <mesh
            key={`end-pad-${end}-${y}`}
            position={[end * 2.02, y, side * 0.02]}
            rotation={[0, 0, end * 0.22]}
          >
            <boxGeometry args={[0.12, 0.08, 0.64]} />
            <meshStandardMaterial color="#0b1115" roughness={0.66} metalness={0.22} />
          </mesh>
        )),
      )}

      <mesh position={[0, 0.43, side * 0.04]}>
        <boxGeometry args={[3.66, 0.055, 0.62]} />
        <meshStandardMaterial color="#6f7c86" roughness={0.24} metalness={0.5} />
      </mesh>
    </group>
  );
}

function ExcavatorBodyAssembly() {
  return (
    <group>
      <group position={[-0.72, 0.24, 0]}>
        {[-1, 1].map((side) => (
          <TankTrack key={side} side={side as 1 | -1} />
        ))}
        <mesh position={[0.05, 0.47, 0]}>
          <boxGeometry args={[3.92, 0.22, 1.72]} />
          <meshStandardMaterial color="#18242b" roughness={0.46} metalness={0.22} />
        </mesh>
        <mesh position={[0.05, 0.61, 0]}>
          <boxGeometry args={[3.54, 0.08, 1.42]} />
          <meshStandardMaterial color="#53616c" roughness={0.28} metalness={0.38} />
        </mesh>
      </group>

      <group position={[-0.52, 0.76, 0]}>
        <mesh position={[-0.18, 0, 0]}>
          <boxGeometry args={[2.75, 0.4, 1.74]} />
          <meshStandardMaterial color="#111a20" roughness={0.54} metalness={0.16} />
        </mesh>
        <mesh position={[0.78, 0.03, 0]}>
          <boxGeometry args={[0.86, 0.42, 1.54]} />
          <meshStandardMaterial color="#d92323" roughness={0.32} metalness={0.18} />
        </mesh>
        <mesh position={[0.78, 0.27, -0.68]}>
          <boxGeometry args={[0.68, 0.055, 0.045]} />
          <meshStandardMaterial color="#ff6b56" roughness={0.22} metalness={0.16} />
        </mesh>
        <mesh position={[0.78, -0.21, -0.68]}>
          <boxGeometry args={[0.68, 0.045, 0.045]} />
          <meshStandardMaterial color="#7c1111" roughness={0.5} metalness={0.08} />
        </mesh>
        <mesh position={[-1.12, 0.08, 0]}>
          <boxGeometry args={[0.58, 0.48, 1.62]} />
          <meshStandardMaterial color="#202a31" roughness={0.52} metalness={0.18} />
        </mesh>
      </group>

      <group position={[-1.28, 1.45, -0.36]}>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[1.28, 1.64, 1.08]} />
          <meshStandardMaterial color="#111a20" roughness={0.36} metalness={0.26} />
        </mesh>
        <mesh position={[0, 0.06, -0.61]}>
          <boxGeometry args={[1.08, 1.44, 0.04]} />
          <meshStandardMaterial color="#0a1115" roughness={0.32} metalness={0.28} />
        </mesh>
        <mesh position={[0.02, 0.18, -0.57]}>
          <boxGeometry args={[0.92, 1.28, 0.035]} />
          <CabWindowMaterial />
        </mesh>
        <mesh position={[0.02, 0.18, -0.545]}>
          <boxGeometry args={[0.82, 0.035, 0.025]} />
          <meshStandardMaterial color="#b8c7cf" roughness={0.18} metalness={0.5} />
        </mesh>
        <mesh position={[0.02, 0.62, -0.545]}>
          <boxGeometry args={[0.84, 0.035, 0.025]} />
          <meshStandardMaterial color="#b8c7cf" roughness={0.18} metalness={0.5} />
        </mesh>
        <mesh position={[0.46, 0.18, -0.545]}>
          <boxGeometry args={[0.035, 1.1, 0.025]} />
          <meshStandardMaterial color="#b8c7cf" roughness={0.18} metalness={0.5} />
        </mesh>
        <mesh position={[0.66, 0.08, -0.06]} rotation={[0, -0.12, 0]}>
          <boxGeometry args={[0.035, 1.18, 0.78]} />
          <CabWindowMaterial />
        </mesh>
        <mesh position={[0, 0.98, 0]}>
          <boxGeometry args={[1.42, 0.18, 1.18]} />
          <meshStandardMaterial color="#0e151a" roughness={0.5} metalness={0.2} />
        </mesh>
        <mesh position={[-0.62, -0.58, -0.6]}>
          <boxGeometry args={[0.24, 0.42, 0.06]} />
          <meshStandardMaterial color="#d92323" roughness={0.34} metalness={0.14} />
        </mesh>
        <mesh position={[0.7, -0.12, -0.4]}>
          <boxGeometry args={[0.08, 0.62, 0.08]} />
          <meshStandardMaterial color="#0b1115" roughness={0.42} metalness={0.24} />
        </mesh>
        <mesh position={[-0.28, -0.28, -0.46]}>
          <boxGeometry args={[0.36, 0.18, 0.28]} />
          <meshStandardMaterial color="#2b343c" roughness={0.54} metalness={0.14} />
        </mesh>
      </group>

      <group position={[0.45, 0.98, 0]}>
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.74, 0.88, 1.45, 40]} />
          <meshStandardMaterial color="#101820" roughness={0.38} metalness={0.42} />
        </mesh>
        <mesh position={[0.18, 0.36, 0]}>
          <boxGeometry args={[0.92, 0.7, 1.0]} />
          <meshStandardMaterial color="#d52222" roughness={0.3} metalness={0.18} />
        </mesh>
        <mesh position={[0.48, 0.68, 0]}>
          <boxGeometry args={[0.36, 1.1, 0.62]} />
          <meshStandardMaterial color="#242c36" roughness={0.42} metalness={0.28} />
        </mesh>
        <mesh position={[0.78, 0.46, 0]}>
          <boxGeometry args={[0.62, 0.5, 0.74]} />
          <meshStandardMaterial color="#ef3127" roughness={0.28} metalness={0.18} />
        </mesh>
        <mesh position={[0.96, 0.74, -0.34]}>
          <boxGeometry args={[0.3, 0.05, 0.05]} />
          <meshStandardMaterial color="#ff8a70" roughness={0.18} metalness={0.14} />
        </mesh>
      </group>

      <group position={[1.16, 0.37, 0]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.18, 0.48, 2.55]} />
          <meshStandardMaterial color="#26343d" roughness={0.56} metalness={0.18} />
        </mesh>
        <mesh position={[0.22, -0.08, 0]} rotation={[0, 0, -0.08]}>
          <boxGeometry args={[0.32, 0.96, 2.7]} />
          <meshStandardMaterial color="#3b4852" roughness={0.58} metalness={0.16} />
        </mesh>
      </group>
    </group>
  );
}

function ExcavatorArm({
  simRef,
  auxiliaryRef,
  inputRef,
  showBody,
}: {
  simRef: React.MutableRefObject<ExcavatorSimState>;
  auxiliaryRef: React.RefObject<AuxiliaryControlState>;
  inputRef: React.RefObject<ExcavatorControlState>;
  showBody: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const boomSwingRef = useRef<THREE.Group>(null);
  const boomRef = useRef<THREE.Group>(null);
  const armRef = useRef<THREE.Group>(null);
  const bucketRef = useRef<THREE.Group>(null);
  const dirtRef = useRef<THREE.Mesh>(null);
  const tipRef = useRef<THREE.Mesh>(null);
  const bladeRef = useRef<THREE.Group>(null);
  const yanmarLogo = useLoader(THREE.TextureLoader, "/images/yanmar/yanmar-logo-white.png");
  const ykLogo = useMemo(() => createLabelTexture("YK건기"), []);

  useLayoutEffect(() => {
    configureDecalTexture(yanmarLogo);
  }, [yanmarLogo]);

  const boomLen = 3;
  const armLen = 2.5;
  const bucketLen = 1.2;
  const armRootY = showBody ? 1.0 : 0.12;

  useFrame(() => {
    const g = groupRef.current;
    const s = simRef.current;
    if (!g) return;
    g.position.set(s.posX, 0, s.posZ);
    g.rotation.y = s.heading + s.swing;
    const aux = auxiliaryRef.current;
    if (boomSwingRef.current) boomSwingRef.current.rotation.y = (aux?.boomSwing ?? 0) * 0.38;
    // Match the visual pivots to bucket.ts: segment direction is (sin(theta), cos(theta)).
    if (boomRef.current) boomRef.current.rotation.z = Math.PI / 2 - s.boom;
    if (armRef.current) armRef.current.rotation.z = s.arm * 1.18;
    if (bucketRef.current) bucketRef.current.rotation.z = s.bucket * 1.02;
    if (bladeRef.current) bladeRef.current.position.y = 0.25 + (aux?.blade ?? 0) * 0.36;
    if (dirtRef.current) {
      const load = s.bucketLoad;
      dirtRef.current.visible = load > 0.03;
      const fill = Math.min(1, Math.max(0, load));
      dirtRef.current.scale.set(
        0.25 + fill * 0.75,
        0.16 + fill * 0.84,
        0.35 + fill * 0.65,
      );
      dirtRef.current.position.set(
        0.28 + fill * 0.2,
        -0.43 + fill * 0.12,
        0,
      );
    }

    if (tipRef.current) {
      const boomEndX = Math.sin(s.boom) * boomLen;
      const boomEndY = Math.cos(s.boom) * boomLen;
      const visualArmAngle = s.boom - s.arm * 1.18;
      const visualBucketAngle = visualArmAngle - s.bucket * 1.02;
      const armEndX = boomEndX + Math.sin(visualArmAngle) * armLen;
      const armEndY = boomEndY + Math.cos(visualArmAngle) * armLen;
      const tipX = armEndX - Math.sin(visualBucketAngle) * bucketLen;
      const tipY = armEndY - Math.cos(visualBucketAngle) * bucketLen;
      tipRef.current.position.set(0.8 + tipX, armRootY + tipY, 0);
    }
  });

  return (
    <group ref={groupRef}>
      {/* 모델 전방(+X)을 주행·시선 방향(+Z)과 일치 */}
      <group rotation={[0, -Math.PI / 2, 0]}>
        <group visible={showBody}>
          <ExcavatorBodyAssembly />
        </group>
        <group ref={bladeRef} visible={showBody} position={[-0.75, 0.25, 0]} />

        <group ref={boomSwingRef} position={[0.8, armRootY, 0]}>
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.28, 0.28, 0.55, 24]} />
          <meshStandardMaterial color="#2b3139" roughness={0.38} metalness={0.32} />
        </mesh>
        <group ref={boomRef}>
          <RedLinkPanel
            length={boomLen}
            height={0.42}
            sideDepth={0.155}
            logo={ykLogo ?? undefined}
            logoWidth={YK_LOGO_WIDTH}
            logoHeight={logoHeightForWidth(YK_LOGO_WIDTH, YK_LABEL_ASPECT)}
            logoX={boomLen * 0.48}
            coreStartRatio={0.24}
            rootReliefScale={1.55}
          />
          <LinkPin x={0} y={0} radius={0.21} width={0.58} />
          <LinkPin x={boomLen} y={0} radius={0.19} width={0.54} />
          <LinkPin x={boomLen * 0.32} y={0.34} radius={0.13} width={0.5} />
          <HydraulicCylinder x={boomLen * 0.58} y={0.43} length={boomLen * 0.62} angle={0.08} />
          <mesh position={[boomLen * 0.58, 0.28, 0]}>
            <boxGeometry args={[boomLen * 0.55, 0.045, 0.34]} />
            <meshStandardMaterial color="#ef3b2f" roughness={0.36} metalness={0.12} />
          </mesh>

          <group ref={armRef} position={[boomLen, 0, 0]}>
            <RedLinkPanel
              length={armLen}
              height={0.36}
              sideDepth={0.135}
              logo={yanmarLogo}
              logoWidth={YANMAR_LOGO_WIDTH}
              logoHeight={logoHeightForWidth(YANMAR_LOGO_WIDTH, YANMAR_LOGO_ASPECT)}
              logoX={armLen * 0.52}
            />
            <LinkPin x={0} y={0} radius={0.18} width={0.52} />
            <LinkPin x={armLen} y={0} radius={0.15} width={0.48} />
            <HydraulicCylinder x={armLen * 0.43} y={0.34} length={armLen * 0.72} angle={-0.05} />
            <mesh position={[armLen * 0.58, 0.2, 0]}>
              <boxGeometry args={[armLen * 0.54, 0.04, 0.3]} />
              <meshStandardMaterial color="#ef3b2f" roughness={0.36} metalness={0.12} />
            </mesh>

            <group ref={bucketRef} position={[armLen, 0, 0]}>
              <ExcavatorBucket dirtRef={dirtRef} />
            </group>
          </group>
        </group>
      </group>

      <mesh ref={tipRef} visible={false}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#ff5722" />
      </mesh>
      </group>
    </group>
  );
}

function GameCamera({
  simRef,
  mode,
  portrait,
}: {
  simRef: React.MutableRefObject<ExcavatorSimState>;
  mode: CameraMode;
  portrait: boolean;
}) {
  const portraitRef = useRef(portrait);
  portraitRef.current = portrait;

  useFrame(({ camera }) => {
    const s = simRef.current;
    const facing = s.heading + s.swing;
    const forwardX = Math.sin(facing);
    const forwardZ = Math.cos(facing);
    const sideX = Math.cos(facing);
    const sideZ = -Math.sin(facing);
    const isPortrait = portraitRef.current;
    const persp = camera as THREE.PerspectiveCamera;

    if (mode === 1) {
      // Portrait cam1: keep boom root filling the lower frame (not floating mid-screen / distant).
      // Wide FOV was making the arm look far away — stay near landscape FOV and pull in.
      const camY = isPortrait ? 1.58 : 1.92;
      const lookY = isPortrait ? -0.08 : 1.04;
      const back = isPortrait ? 1.28 : 1.95;
      const lookAhead = isPortrait ? 4.35 : 5.35;
      const side = isPortrait ? 0.42 : 0.58;
      const fov = isPortrait ? 56 : 58;
      if (Math.abs(persp.fov - fov) > 0.01) {
        persp.fov = fov;
        persp.updateProjectionMatrix();
      }
      const camX = s.posX - forwardX * back + sideX * side;
      const camZ = s.posZ - forwardZ * back + sideZ * side;
      camera.position.set(camX, camY, camZ);
      const lookX = s.posX + forwardX * lookAhead - sideX * 0.22;
      const lookZ = s.posZ + forwardZ * lookAhead - sideZ * 0.22;
      camera.lookAt(lookX, lookY, lookZ);
      return;
    }

    if (Math.abs(persp.fov - 58) > 0.01) {
      persp.fov = 58;
      persp.updateProjectionMatrix();
    }

    if (mode === 2) {
      camera.position.set(
        s.posX - forwardX * 7.2 + sideX * 3.4,
        isPortrait ? 4.35 : 4.9,
        s.posZ - forwardZ * 7.2 + sideZ * 3.4,
      );
      camera.lookAt(
        s.posX + forwardX * 3.25 - sideX * 0.5,
        isPortrait ? 1.55 : 2.05,
        s.posZ + forwardZ * 3.25 - sideZ * 0.5,
      );
      return;
    }

    camera.position.set(
      s.posX - forwardX * 14.5 + sideX * 7.8,
      isPortrait ? 7.4 : 8.2,
      s.posZ - forwardZ * 14.5 + sideZ * 7.8,
    );
    camera.lookAt(
      s.posX + forwardX * 4.4 - sideX * 0.8,
      isPortrait ? 1.55 : 2.0,
      s.posZ + forwardZ * 4.4 - sideZ * 0.8,
    );
  });
  return null;
}

// Use the visible bucket shell's lowest sampled point, not the old mathematical tip.
const MIN_BUCKET_GROUND_CLEARANCE = -1.05;
function bucketClearance(sim: ExcavatorSimState, terrain: TerrainData, boomSwing: number) {
  const tip = getBucketBodyContactWorld(sim, boomSwing);
  const groundH = sampleHeight(terrain, tip.x, tip.z);
  return {
    tip,
    groundH,
    depthBelow: groundH - tip.y,
    clearance: tip.y - groundH,
  };
}

function constrainBucketGroundContact(
  sim: ExcavatorSimState,
  terrain: TerrainData,
  boomSwing: number,
) {
  return bucketClearance(sim, terrain, boomSwing);
}

function SimLoop({
  inputRef,
  simRef,
  velRef,
  terrainRef,
  scoreRef,
  modeRef,
  equipmentStatsRef,
  allowedRef,
  auxiliaryRef,
  tutorialDumpRef,
  digFeedbackRef,
  onProgress,
  onDumpScore,
  onSimTick,
}: ExcavatorSceneProps) {
  const lastReportedProgressRef = useRef(-1);
  const dumpScoreRemainderRef = useRef(0);
  const dustRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const sim = simRef.current;
    const raw = inputRef.current;
    const allowed = allowedRef.current;
    let filtered = filterInput(raw, allowed);
    const fb = digFeedbackRef.current;

    const hydraulicSpeedScale = auxiliaryRef.current?.highSpeed ? 0.5 : 0.25;
    const boomSwing = auxiliaryRef.current?.boomSwing ?? 0;
    const beforeControlClearance = bucketClearance(sim, terrainRef.current, boomSwing).clearance;
    const bucketAnchoredToGround = beforeControlClearance < 0.18;
    if (bucketAnchoredToGround) {
      filtered = {
        ...filtered,
        travel: { left: 0, right: 0 },
      };
      velRef.current.travel = 0;
      velRef.current.trackTurn = 0;
    }
    const beforeGroundContact = {
      boom: sim.boom,
      arm: sim.arm,
      bucket: sim.bucket,
    };
    applyControls(
      sim,
      filtered,
      dt,
      velRef.current,
      hydraulicSpeedScale,
      equipmentStatsRef.current.travelSpeedMultiplier,
    );

    let { clearance } = constrainBucketGroundContact(
      sim,
      terrainRef.current,
      boomSwing,
    );
    if (clearance < MIN_BUCKET_GROUND_CLEARANCE - 0.02) {
      sim.boom = beforeGroundContact.boom;
      sim.arm = beforeGroundContact.arm;
      sim.bucket = beforeGroundContact.bucket;
      // 땅 쪽으로 밀어넣는 속도만 정지 — 들어올리기·말기 방향 조작은 유지
      if (velRef.current.boom > 0) velRef.current.boom = 0;
      if (velRef.current.arm > 0) velRef.current.arm = 0;
      if (velRef.current.bucket > 0) velRef.current.bucket = 0;
      ({ clearance } = constrainBucketGroundContact(
        sim,
        terrainRef.current,
        boomSwing,
      ));
    }
    const scraper = getBucketScraperContactWorld(sim, boomSwing);
    const bucketTip = getBucketTipWorld(sim, boomSwing);
    const scraperGroundH = sampleHeight(terrainRef.current, scraper.x, scraper.z);
    const scraperDepthBelow = scraperGroundH - scraper.y;
    updateDigZoneRespawns(terrainRef.current);
    const activeDigZones = getActiveDigZones(terrainRef.current);
    const scraperInDigZone = isInDigZone(scraper.x, scraper.z, terrainRef.current);
    const tipInDigZone = isInDigZone(bucketTip.x, bucketTip.z, terrainRef.current);
    const bodyNearDigZone =
      activeDigZones.some(
        (zone) => Math.hypot(sim.posX - zone.x, sim.posZ - zone.z) < zone.radius + 9,
      );
    const inZone = scraperInDigZone || tipInDigZone || bodyNearDigZone;
    const inDump = isInDumpZone(scraper.x, scraper.z) || isInDumpZone(bucketTip.x, bucketTip.z);
    const bucketInWorkRange = scraperDepthBelow > -1.4 && scraperDepthBelow < 2.6;
    const tipOnGround = scraperDepthBelow > -1.2 && scraperDepthBelow < 2.6;
    const curled = isBucketCurled(sim.boom, sim.bucket);
    const bucketOpenReady = sim.bucket >= -0.05 && sim.bucket <= 1.85;
    const insertedDeepEnough = scraperDepthBelow >= -0.15 && scraperDepthBelow <= 2.75;
    const bucketCurlReady =
      sim.bucket <= 1.05 || filtered.right.x < -0.08 || velRef.current.bucket < -0.025;
    const armPulling = filtered.left.y > 0.05 || velRef.current.arm < -0.025;
    const naturalDigPose =
      inZone &&
      bucketInWorkRange &&
      bucketOpenReady &&
      insertedDeepEnough &&
      bucketCurlReady &&
      armPulling;
    const digPoseScore =
      (bucketOpenReady ? 1 : 0) +
      (insertedDeepEnough ? 1 : 0) +
      (bucketCurlReady ? 1 : 0) +
      (armPulling ? 1 : 0);
    const poseReadiness = digPoseScore / 4;
    const canLoad = bucketInWorkRange && poseReadiness >= 0.5;

    fb.inDigZone = inZone;
    fb.inDumpZone = inDump;
    fb.tipOnGround = tipOnGround;
    fb.bucketCurled = curled;
    fb.canLoad = canLoad;
    fb.groundDepth = scraperDepthBelow;
    fb.digging = false;
    fb.bucketOpenReady = bucketOpenReady;
    fb.insertedDeepEnough = insertedDeepEnough;
    fb.bucketCurlReady = bucketCurlReady;
    fb.armPulling = armPulling;
    fb.optimalDigPose = naturalDigPose;
    fb.digPoseScore = poseReadiness;

    const isGame = modeRef.current === "game";

    const isTutorial = modeRef.current === "tutorial";
    const digRate = isTutorial ? 9.5 : 7.2;
    const loadRate = isTutorial ? 7.0 : 5.4;

    if (inZone && bucketInWorkRange && sim.bucketLoad < 1) {
      const scrape = Math.max(0.38, scraperDepthBelow + 0.9);
      const digX = scraperInDigZone ? scraper.x : tipInDigZone ? bucketTip.x : scraper.x;
      const digZ = scraperInDigZone ? scraper.z : tipInDigZone ? bucketTip.z : scraper.z;
      const scrapeMotion =
        Math.abs(velRef.current.arm) * 0.8 +
        Math.abs(velRef.current.travel) * 0.22 +
        Math.abs(velRef.current.bucket) * 0.35 +
        Math.abs(velRef.current.boom) * 0.25;
      const inputMotion =
        Math.abs(filtered.left.y) * 0.75 +
        Math.abs(filtered.right.y) * 0.3 +
        Math.abs(filtered.right.x) * 0.3;
      const activelyScraping = scrapeMotion > 0.015 || inputMotion > 0.05 || naturalDigPose;
      const naturalLoadReady = inZone && bucketInWorkRange && poseReadiness >= 0.5;
      const dug =
        naturalLoadReady && activelyScraping
          ? digAt(
              terrainRef.current,
              digX,
              digZ,
              naturalDigPose ? 4.4 : 3.7,
              scrape * dt * digRate * (naturalDigPose ? 1.35 : 1.08),
            )
          : 0;
      fb.digging = dug > 0.002 || (naturalLoadReady && activelyScraping);

      if (naturalLoadReady && activelyScraping) {
        const poseBonus = 0.85 + fb.digPoseScore * 0.9;
        const scrapeLoad =
          (scrapeMotion + inputMotion * 0.24) * (isTutorial ? 0.22 : 0.17) * dt;
        const minimumLoad = (isTutorial ? 0.75 : 0.52) * poseBonus * dt;
        const maxLoadDelta = (isTutorial ? 0.92 : 0.72) * poseBonus * dt;
        const loadDelta = Math.min(
          Math.max(dug * loadRate * 0.45 + scrapeLoad, minimumLoad),
          maxLoadDelta,
        );
        sim.bucketLoad = Math.min(
          1,
          sim.bucketLoad + loadDelta,
        );
      }

      if (dustRef.current && fb.digging) {
        dustRef.current.visible = true;
        dustRef.current.position.set(digX, scraperGroundH + 0.15, digZ);
        const s = 0.8 + Math.random() * 0.5;
        dustRef.current.scale.setScalar(s);
      } else if (dustRef.current) {
        dustRef.current.visible = false;
      }
    } else if (dustRef.current) {
      dustRef.current.visible = false;
    }

    const bucketDumpOpen = sim.bucket > 1.35;
    const bucketFullyOpen = sim.bucket > 2.15;
    if (sim.bucketLoad > 0 && bucketDumpOpen) {
      const spillRate = inDump ? 1.5 : bucketFullyOpen ? 2.2 : 0.75;
      const remainingLoad = sim.bucketLoad;
      const dumpAmount =
        remainingLoad < 0.025
          ? remainingLoad
          : Math.min(remainingLoad, remainingLoad * spillRate * dt);
      sim.bucketLoad = Math.max(0, sim.bucketLoad - dumpAmount);
      if (inDump) {
        if (isGame) {
          scoreRef.current.dumped += dumpAmount;
          const progress = Math.min(
            100,
            Math.round((scoreRef.current.dumped / scoreRef.current.target) * 100),
          );
          if (progress !== lastReportedProgressRef.current) {
            lastReportedProgressRef.current = progress;
            onProgress(scoreRef.current.dumped, progress);
          }
        } else {
          tutorialDumpRef.current += dumpAmount;
        }

        const stats = equipmentStatsRef.current;
        const chunkRatio = stats.scoreChunkUnits / stats.maxLoadUnits;
        dumpScoreRemainderRef.current += dumpAmount;
        while (dumpScoreRemainderRef.current >= chunkRatio) {
          dumpScoreRemainderRef.current -= chunkRatio;
          const critical = Math.random() < stats.criticalChance;
          const dropX = isInDumpZone(bucketTip.x, bucketTip.z) ? bucketTip.x : scraper.x;
          const dropZ = isInDumpZone(bucketTip.x, bucketTip.z) ? bucketTip.z : scraper.z;
          const dropY = sampleHeight(terrainRef.current, dropX, dropZ) + 0.9;
          onDumpScore({
            score: Math.round(
              stats.baseScorePerChunk * (critical ? stats.criticalMultiplier : 1),
            ),
            critical,
            x: dropX,
            y: dropY,
            z: dropZ,
          });
        }
      }
    }

    onSimTick();
  });

  return (
    <mesh ref={dustRef} visible={false}>
      <sphereGeometry args={[0.35, 6, 6]} />
      <meshBasicMaterial color="#8d6e43" transparent opacity={0.55} />
    </mesh>
  );
}

function WaypointMarker({
  tutorialStepRef,
}: {
  tutorialStepRef: React.RefObject<TutorialStep | null>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const ring = ringRef.current;
    const wp = tutorialStepRef.current?.waypoint;
    if (!group) return;
    if (wp) {
      group.visible = true;
      group.position.set(wp.x, 0, wp.z);
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.15;
      group.scale.setScalar(pulse);
      if (ring) ring.rotation.z += delta * 1.5;
    } else {
      group.visible = false;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <ringGeometry args={[2.8, 3.4, 48]} />
        <meshBasicMaterial color="#29b6f6" transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
        <ringGeometry args={[0.4, 0.7, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 8, 8]} />
        <meshBasicMaterial color="#29b6f6" transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 8.5, 0]}>
        <octahedronGeometry args={[0.55, 0]} />
        <meshBasicMaterial color="#4fc3f7" />
      </mesh>
    </group>
  );
}

function ZoneMarkers({ terrainRef }: { terrainRef: React.MutableRefObject<TerrainData> }) {
  const [zones, setZones] = useState(() => getActiveDigZones(terrainRef.current));
  const signatureRef = useRef("");

  useFrame(() => {
    const nextZones = getActiveDigZones(terrainRef.current);
    const signature = nextZones
      .map((zone) => `${zone.id}:${zone.x.toFixed(1)}:${zone.z.toFixed(1)}:${zone.active}`)
      .join("|");
    if (signature !== signatureRef.current) {
      signatureRef.current = signature;
      setZones([...nextZones]);
    }
  });

  return (
    <>
      {zones.map((zone) => (
        <group key={zone.id}>
          <mesh position={[zone.x, 0.15, zone.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[zone.radius, 48]} />
            <meshBasicMaterial color="#ff8f00" transparent opacity={0.18} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[zone.x, 0.2, zone.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[zone.radius - 0.4, zone.radius, 48]} />
            <meshBasicMaterial color="#ffb300" transparent opacity={0.85} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[zone.x, 0.26, zone.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.5, 3.2, 36]} />
            <meshBasicMaterial color="#fff3c4" transparent opacity={0.7} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      <mesh position={[DUMP_ZONE.x, 0.12, DUMP_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[DUMP_ZONE.radius, 40]} />
        <meshBasicMaterial color="#1b5e20" transparent opacity={0.16} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[DUMP_ZONE.x, 0.2, DUMP_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[DUMP_ZONE.radius - 0.3, DUMP_ZONE.radius, 32]} />
        <meshBasicMaterial color="#66bb6a" transparent opacity={0.82} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[DUMP_ZONE.x, 0.25, DUMP_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[4.2, 4.2, 0.08]} />
        <meshBasicMaterial color="#a5d6a7" transparent opacity={0.55} />
      </mesh>
    </>
  );
}

function SafetyCone({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.1, z]}>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.36, 0.46, 0.18, 12]} />
        <meshStandardMaterial color="#15171d" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.58, 0]}>
        <coneGeometry args={[0.32, 0.95, 16]} />
        <meshStandardMaterial color="#ff5a1f" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.66, 0]}>
        <cylinderGeometry args={[0.22, 0.27, 0.08, 16]} />
        <meshStandardMaterial color="#fff3d0" roughness={0.45} />
      </mesh>
    </group>
  );
}

function WorksiteSetDressing() {
  const cones = [
    [-35, -35],
    [-15, -35],
    [5, -35],
    [25, -35],
    [43, -25],
    [43, -5],
    [43, 15],
    [-35, 34],
    [-12, 34],
    [10, 34],
    [32, 28],
  ] as const;

  return (
    <>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[63, 64, 4]} />
        <meshBasicMaterial color="#e53935" transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <ringGeometry args={[59.5, 60, 4]} />
        <meshBasicMaterial color="#20242b" transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>
      {cones.map(([x, z]) => (
        <SafetyCone key={`${x}:${z}`} x={x} z={z} />
      ))}
      <mesh position={[DUMP_ZONE.x + 8, 1.8, DUMP_ZONE.z - 7]} rotation={[0, -0.55, 0]}>
        <boxGeometry args={[5.2, 2.2, 0.2]} />
        <meshStandardMaterial color="#263238" roughness={0.4} />
      </mesh>
      <mesh position={[DUMP_ZONE.x + 8, 1.8, DUMP_ZONE.z - 7.12]} rotation={[0, -0.55, 0]}>
        <boxGeometry args={[4.5, 1.5, 0.08]} />
        <meshBasicMaterial color="#4caf50" transparent opacity={0.8} />
      </mesh>
    </>
  );
}

function Cloud({
  x,
  y,
  z,
  scale = 1,
}: {
  x: number;
  y: number;
  z: number;
  scale?: number;
}) {
  const puffs = [
    [-1.2, 0, 0, 0.9],
    [-0.45, 0.15, 0.08, 1.15],
    [0.45, 0.1, -0.04, 1],
    [1.15, -0.04, 0.02, 0.72],
  ] as const;

  return (
    <group position={[x, y, z]} scale={[scale, scale, scale]}>
      {puffs.map(([px, py, pz, s], i) => (
        <mesh key={i} position={[px, py, pz]}>
          <sphereGeometry args={[1.05 * s, 16, 10]} />
          <meshBasicMaterial color="#f6fbff" transparent opacity={0.74} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function SunnySky() {
  return (
    <>
      <mesh position={[34, 35, -60]} rotation={[0, -0.42, 0]}>
        <circleGeometry args={[4.2, 40]} />
        <meshBasicMaterial color="#fff1a6" transparent opacity={0.95} depthWrite={false} />
      </mesh>
      <mesh position={[34, 35, -60]} rotation={[0, -0.42, 0]}>
        <circleGeometry args={[7.2, 40]} />
        <meshBasicMaterial color="#ffd66b" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <Cloud x={-34} y={24} z={-55} scale={2.8} />
      <Cloud x={-8} y={28} z={-72} scale={2.2} />
      <Cloud x={28} y={23} z={-48} scale={1.8} />
      <Cloud x={44} y={30} z={-78} scale={2.5} />
    </>
  );
}

function AuxiliarySceneEffects({
  auxiliaryRef: _auxiliaryRef,
}: {
  auxiliaryRef: React.RefObject<AuxiliaryControlState>;
}) {
  return null;
}

function SceneContent(props: ExcavatorSceneProps) {
  return (
    <>
      <color attach="background" args={["#9fd2f2"]} />
      <fog attach="fog" args={["#b8dcf1", 90, 260]} />
      <hemisphereLight args={["#e8f7ff", "#c58b54", 0.72]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[22, 34, -28]}
        intensity={2.25}
        color="#fff2c1"
        castShadow={false}
      />
      <pointLight position={[34, 31, -56]} intensity={0.58} color="#ffe28a" distance={95} />
      <SunnySky />
      <TerrainMesh terrainRef={props.terrainRef} />
      <WorksiteSetDressing />
      <ZoneMarkers terrainRef={props.terrainRef} />
      <WaypointMarker tutorialStepRef={props.tutorialStepRef} />
      <AuxiliarySceneEffects auxiliaryRef={props.auxiliaryRef} />
      <ExcavatorArm
        simRef={props.simRef}
        auxiliaryRef={props.auxiliaryRef}
        inputRef={props.inputRef}
        showBody={props.cameraMode !== 1}
      />
      <GameCamera
        simRef={props.simRef}
        mode={props.cameraMode}
        portrait={props.layoutPortrait}
      />
      <SimLoop {...props} />
    </>
  );
}

export function ExcavatorScene(props: ExcavatorSceneProps) {
  return (
    <Canvas
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        alpha: false,
        stencil: false,
      }}
      dpr={[1, 2]}
      camera={{ fov: 58, near: 0.1, far: 180 }}
      style={{ width: "100%", height: "100%" }}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}

export function createInitialSim(): ExcavatorSimState {
  return {
    swing: 0,
    boom: 0.45,
    arm: -0.95,
    bucket: -0.12,
    posX: -18,
    posZ: -22,
    heading: 0,
    bucketLoad: 0,
  };
}

export function createInitialTerrain(dynamicDigZones = false): TerrainData {
  return createTerrain(-48, -48, dynamicDigZones);
}
