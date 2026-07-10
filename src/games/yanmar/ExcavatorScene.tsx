"use client";

/* eslint-disable react-hooks/refs */

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { RoundedBox, Text, Billboard } from "@react-three/drei";
import * as THREE from "three";
import type { AuxiliaryControlState, ExcavatorControlState, ControlMask, HydraulicVelocity } from "./controls";
import { ExcavatorBucket } from "./ExcavatorBucket";
import {
  createTerrain,
  digZoneLabel,
  getActiveDigZones,
  isInDumpZone,
  dumpTruckBedDeckWorldY,
  sampleHeight,
  type TerrainData,
  DIG_ZONE,
  DUMP_ZONE,
  DUMP_TRUCK,
  DUMP_TRUCK_BED,
} from "./terrain";
import type { DigFeedback } from "./bucket";
import {
  formatDumpTruckReturnTime,
  getDumpTruckFillRatio,
  getDumpTruckMotionProgress,
  getDumpTruckPose,
  getDumpTruckReturnEtaSec,
  isDumpTruckVisible,
  shouldShowDumpTruckReturnTimer,
  type DumpTruckPose,
  type DumpTruckRuntimeState,
} from "./dumpTruckState";
import type { DiggingScoreState } from "./scoring";
import type { GameMode, TutorialStep } from "./tutorial";
import type { YanmarEquipmentStats } from "./equipment";
import {
  createGroundDirtTexture,
  createRockTexture,
} from "./proceduralTextures";
import {
  buildTerrainScatterRocks,
  createRockGeometry,
  type ScatterRock,
} from "./terrainScatter";
import { MapSiteDecor } from "./mapDecor";
import type { CameraMode, DumpScorePopup, ExcavatorSimState, AutoPoseState } from "./types";
import {
  createSimLoopRuntime,
  tickExcavatorSim,
  type DumpSoilVisual,
} from "./simLoop";

export type { CameraMode, DumpScorePopup, ExcavatorSimState };

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
  autoPoseRef: React.RefObject<AutoPoseState>;
  tutorialStepRef: React.RefObject<TutorialStep | null>;
  tutorialDumpRef: React.MutableRefObject<number>;
  digFeedbackRef: React.MutableRefObject<DigFeedback>;
  dumpTruckStateRef: React.MutableRefObject<DumpTruckRuntimeState>;
  dumpTruckPoseRef: React.MutableRefObject<DumpTruckPose>;
  onProgress: (dumped: number, progress: number) => void;
  onDumpScore: (popup: Omit<DumpScorePopup, "id">) => void;
  onSimTick: () => void;
  cameraMode: CameraMode;
}

function TerrainMesh({ terrainRef }: { terrainRef: React.MutableRefObject<TerrainData> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geomRef = useRef<THREE.PlaneGeometry | null>(null);
  const colorsRef = useRef<Float32Array | null>(null);
  const dirtTexture = useMemo(() => createGroundDirtTexture(), []);

  useLayoutEffect(() => () => dirtTexture.dispose(), [dirtTexture]);

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
    const cGround = new THREE.Color("#d4b07a");
    const cDug = new THREE.Color("#7a5230");
    const cDeepDug = new THREE.Color("#5c3d22");
    const cMound = new THREE.Color("#e8c88a");
    const cMoundPeak = new THREE.Color("#f2d9a6");
    const cPacked = new THREE.Color("#b89262");
    const cGravel = new THREE.Color("#c4b29a");

    const heightAt = (gx: number, gz: number) => {
      const cx = Math.max(0, Math.min(t.gridSize - 1, gx));
      const cz = Math.max(0, Math.min(t.gridSize - 1, gz));
      return t.heights[cz * t.gridSize + cx];
    };

    for (let gz = 0; gz < t.gridSize; gz++) {
      for (let gx = 0; gx < t.gridSize; gx++) {
        const idx = gz * t.gridSize + gx;
        const vi = idx;
        const h = t.heights[idx];
        pos.setY(vi, h);

        const wx = t.originX + (gx + 0.5) * t.cellSize;
        const wz = t.originZ + (gz + 0.5) * t.cellSize;
        const dug = t.baseHeights[idx] - h;
        const moundRatio = h > 1.15 ? Math.min(1, (h - 1.15) / 0.95) : 0;
        const slope =
          Math.abs(heightAt(gx + 1, gz) - heightAt(gx - 1, gz)) +
          Math.abs(heightAt(gx, gz + 1) - heightAt(gx, gz - 1));
        const roadBlend = Math.max(
          0,
          1 - Math.hypot(wx + 18, wz + 22) / 42,
        ) * (h < 0.8 ? 1 : 0.35);
        const truckLaneBlend =
          h >= 0.685 && h <= 0.735 && wx > 24 && wx < 76 && wz > -18 && wz < 8 ? 0.42 : 0;

        const col = cGround.clone();
        if (dug > 0.04) {
          const digBlend = Math.min(1, dug / 0.32);
          col.lerp(dug > 0.22 ? cDeepDug : cDug, digBlend);
        } else if (moundRatio > 0) {
          col.lerp(h > 1.85 ? cMoundPeak : cMound, moundRatio * 0.82);
        } else if (h < 0.82) {
          col.lerp(cPacked, 0.22);
        }
        if (roadBlend > 0.08) {
          col.lerp(cGravel, Math.min(0.55, roadBlend));
        }
        if (truckLaneBlend > 0) {
          col.lerp(cGravel, truckLaneBlend);
        }

        if (slope > 0.12) {
          col.multiplyScalar(1 - Math.min(0.28, slope * 0.1));
        }

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
      receiveShadow
    >
      <meshStandardMaterial
        map={dirtTexture}
        vertexColors
        roughness={0.9}
        metalness={0.015}
      />
    </mesh>
  );
}

function TerrainRockScatter({ terrainRef }: { terrainRef: React.MutableRefObject<TerrainData> }) {
  const rockTexture = useMemo(() => createRockTexture(), []);
  const rockGeometry = useMemo(() => createRockGeometry(), []);
  const [rocks, setRocks] = useState<ScatterRock[]>(() =>
    buildTerrainScatterRocks(terrainRef.current),
  );
  const zoneSignatureRef = useRef("");

  useLayoutEffect(() => () => {
    rockTexture.dispose();
    rockGeometry.dispose();
  }, [rockTexture, rockGeometry]);

  useFrame(() => {
    const signature = terrainRef.current.digZones
      .map((zone) => `${zone.id}:${zone.x.toFixed(1)}:${zone.z.toFixed(1)}:${zone.active}`)
      .join("|");
    if (signature !== zoneSignatureRef.current) {
      zoneSignatureRef.current = signature;
      setRocks(buildTerrainScatterRocks(terrainRef.current));
    }
  });

  return (
    <group>
      {rocks.map((rock, index) => (
        <mesh
          key={`${rock.x.toFixed(2)}:${rock.z.toFixed(2)}:${index}`}
          geometry={rockGeometry}
          position={[rock.x, rock.y, rock.z]}
          rotation={[rock.rotX, rock.rotY, 0]}
          scale={[rock.scale * 1.1, rock.scale * 0.7, rock.scale]}
        >
          <meshStandardMaterial
            map={rockTexture}
            color="#b0a89c"
            roughness={0.92}
            metalness={0.04}
          />
        </mesh>
      ))}
    </group>
  );
}

function DigDustCloud({
  dustRef,
  digFeedbackRef,
}: {
  dustRef: React.RefObject<THREE.Group | null>;
  digFeedbackRef: React.MutableRefObject<DigFeedback>;
}) {
  const puffRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const group = dustRef.current;
    if (!group) return;
    const digging = digFeedbackRef.current.digging;
    group.visible = digging;
    if (!digging) return;

    const t = state.clock.elapsedTime;
    puffRefs.current.forEach((puff, index) => {
      if (!puff) return;
      const phase = t * 2.4 + index * 0.7;
      puff.position.y = 0.08 + Math.sin(phase) * 0.12 + index * 0.05;
      puff.scale.setScalar(0.55 + Math.sin(phase * 1.3) * 0.18 + index * 0.08);
      const mat = puff.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.28 + Math.sin(phase * 1.6) * 0.12;
    });
  });

  return (
    <group ref={dustRef} visible={false}>
      {[0, 1, 2, 3, 4].map((index) => (
        <mesh
          key={index}
          ref={(node) => {
            puffRefs.current[index] = node;
          }}
          position={[
            (index - 2) * 0.18,
            0.1 + index * 0.04,
            ((index % 2) - 0.5) * 0.16,
          ]}
        >
          <sphereGeometry args={[0.22 + index * 0.03, 6, 6]} />
          <meshBasicMaterial color={index % 2 ? "#a67c4e" : "#c49a62"} transparent opacity={0.42} />
        </mesh>
      ))}
    </group>
  );
}

type DumpSoilVisualState = DumpSoilVisual;

function DumpSoilParticles({
  visualRef,
}: {
  visualRef: React.MutableRefObject<DumpSoilVisualState>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const particleStates = useRef(
    Array.from({ length: 20 }, () => ({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      vy: 0,
      life: 0,
    })),
  );

  useFrame((_, dt) => {
    const group = groupRef.current;
    if (!group) return;

    const visual = visualRef.current;
    visual.intensity = Math.max(0, visual.intensity - dt * 2.8);
    const dumping = visual.active && visual.intensity > 0.02;
    if (!dumping) {
      visual.active = false;
    }

    if (dumping) {
      const spawnBudget = Math.ceil(visual.intensity * 5);
      for (let i = 0; i < spawnBudget; i += 1) {
        const slot = particleStates.current.find((particle) => !particle.active);
        if (!slot) break;
        slot.active = true;
        slot.x = visual.spawnX + (Math.random() - 0.5) * 0.55;
        slot.z = visual.spawnZ + (Math.random() - 0.5) * 0.45;
        slot.y = visual.spawnY + Math.random() * 0.35;
        slot.vy = -(2.2 + Math.random() * 2.4);
        slot.life = 0.55 + Math.random() * 0.45;
      }
    }

    const bedY = dumpTruckBedDeckWorldY() + 0.08;
    let anyVisible = false;
    particleStates.current.forEach((particle, index) => {
      const mesh = group.children[index] as THREE.Mesh | undefined;
      if (!mesh) return;
      if (!particle.active) {
        mesh.visible = false;
        return;
      }
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        mesh.visible = false;
        return;
      }
      particle.vy -= 11.5 * dt;
      particle.y += particle.vy * dt;
      if (particle.y <= bedY) {
        particle.active = false;
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      anyVisible = true;
      mesh.position.set(particle.x, particle.y, particle.z);
      mesh.rotation.x += dt * 4.2;
      mesh.rotation.z += dt * 3.1;
    });
    group.visible = anyVisible;
  });

  return (
    <group ref={groupRef} visible={false}>
      {Array.from({ length: 20 }, (_, index) => (
        <mesh key={index} visible={false}>
          <boxGeometry args={[0.11, 0.07, 0.1]} />
          <meshStandardMaterial color="#7a5230" roughness={0.92} metalness={0.02} />
        </mesh>
      ))}
    </group>
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
const REAR_BODY_PANEL_X = -1.715;
const REAR_BODY_PANEL_Z = -0.36;
const YANMAR_REAR_BODY_Z = -0.24;
const YK_REAR_BODY_Y = 1.42;
const YANMAR_REAR_BODY_Y = 1.22;
const YK_REAR_BODY_WIDTH = 0.88;
const YANMAR_REAR_LOGO_ASPECT = 640 / 160;
const YANMAR_REAR_BODY_WIDTH = 1.0;
const MINI_EXCAVATOR_BODY_LENGTH_SCALE = 0.58;
const MINI_EXCAVATOR_BODY_WIDTH_SCALE = 0.82;
const EXCAVATOR_FIXED_VISUAL_Y = 0.68;

function configureDecalTexture(texture: THREE.Texture, anisotropy = 16) {
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = anisotropy;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.premultiplyAlpha = false;
}

function logoHeightForWidth(width: number, aspect: number) {
  return width / aspect;
}

function createYkGeongiLabelTexture(orientation: "horizontal" | "vertical" = "horizontal") {
  if (typeof document === "undefined") return null;

  const scale = 6;
  const horizontal = orientation === "horizontal";
  const baseWidth = horizontal ? 512 : 168;
  const baseHeight = horizontal ? 160 : 420;
  const canvas = document.createElement("canvas");
  canvas.width = baseWidth * scale;
  canvas.height = baseHeight * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, baseWidth, baseHeight);
  ctx.font = '900 72px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";

  const drawGeongi = (x: number, y: number) => {
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(255,255,255,0.98)";
    ctx.fillStyle = "#111827";
    ctx.strokeText("건기", x, y);
    ctx.fillText("건기", x, y);
  };

  if (horizontal) {
    ctx.fillStyle = "#1565C0";
    ctx.fillText("Y", 168, 82);
    ctx.fillStyle = "#C62828";
    ctx.fillText("K", 228, 82);
    drawGeongi(332, 82);
  } else {
    ctx.fillStyle = "#1565C0";
    ctx.fillText("Y", baseWidth / 2, 96);
    ctx.fillStyle = "#C62828";
    ctx.fillText("K", baseWidth / 2, 168);
    drawGeongi(baseWidth / 2, 268);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  configureDecalTexture(texture);
  return texture;
}

function createYanmarRearLabelTexture() {
  if (typeof document === "undefined") return null;

  const scale = 6;
  const baseWidth = 640;
  const baseHeight = 160;
  const canvas = document.createElement("canvas");
  canvas.width = baseWidth * scale;
  canvas.height = baseHeight * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, baseWidth, baseHeight);
  ctx.fillStyle = "#C62828";

  const drawChevron = (x: number, y: number, w: number, h: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.5, y + h);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w * 0.78, y);
    ctx.lineTo(x + w * 0.5, y + h * 0.55);
    ctx.lineTo(x + w * 0.22, y);
    ctx.closePath();
    ctx.fill();
  };

  // Yanmar emblem: two downward chevrons before the wordmark.
  drawChevron(38, 45, 94, 62);
  drawChevron(38, 82, 94, 44);

  ctx.font = '900 76px Arial, "Helvetica Neue", sans-serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("YANMAR", 168, 84);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  configureDecalTexture(texture);
  return texture;
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
  logoRotation = 0,
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
  logoRotation?: number;
  coreStartRatio?: number;
  rootReliefScale?: number;
}) {
  const coreEndRatio = 0.96;
  const coreLength = length * Math.max(0.1, coreEndRatio - coreStartRatio);
  const coreX = length * ((coreStartRatio + coreEndRatio) / 2);
  const hasLogo = Boolean(logo && logoX != null);

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
          {!hasLogo ? (
            <mesh position={[length * 0.52, 0, 0.058]}>
              <boxGeometry args={[length * 0.72, 0.018, 0.018]} />
              <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.18} />
            </mesh>
          ) : null}
          {hasLogo ? (
            <mesh
              position={[logoX!, 0.04, side * 0.068]}
              rotation={[0, 0, logoRotation]}
              scale={[-1, 1, 1]}
              renderOrder={12}
            >
              <planeGeometry args={[logoWidth, logoHeight]} />
              <meshBasicMaterial
                map={logo}
                transparent
                alphaTest={0.35}
                toneMapped={false}
                depthTest
                depthWrite={false}
                side={THREE.DoubleSide}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
          ) : null}
        </group>
      ))}
      <mesh position={[coreX, 0, 0]}>
        <boxGeometry args={[coreLength, height * 0.62, sideDepth * 1.45]} />
        <meshStandardMaterial color="#aa1515" roughness={0.44} metalness={0.14} />
      </mesh>
    </>
  );
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
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.24, 0.3, 0.115, 28]} />
        <meshStandardMaterial color="#8b97a5" roughness={0.28} metalness={0.48} />
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
        {[0.62, 0.88].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.17, 0.018, 8, 24]} />
            <meshStandardMaterial color="#9aa5b1" roughness={0.22} metalness={0.55} />
          </mesh>
        ))}
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

function TankTrack({
  side,
  velRef,
}: {
  side: 1 | -1;
  velRef: React.MutableRefObject<HydraulicVelocity>;
}) {
  const rollers = [-0.72, -0.36, 0, 0.36, 0.72];
  const lowerPads = Array.from({ length: 9 }, (_, index) => index);
  const upperPads = Array.from({ length: 8 }, (_, index) => index);
  const lowerPadRefs = useRef<(THREE.Group | null)[]>([]);
  const upperPadRefs = useRef<(THREE.Group | null)[]>([]);
  const wheelRefs = useRef<(THREE.Group | null)[]>([]);
  const trackOffsetRef = useRef(0);

  useFrame((_, delta) => {
    const trackSpeed = velRef.current.travel + velRef.current.trackTurn * side * 0.58;
    if (Math.abs(trackSpeed) < 0.01) return;

    trackOffsetRef.current += trackSpeed * delta * 0.62;
    const wrap = (value: number, min: number, max: number) => {
      const span = max - min;
      return ((((value - min) % span) + span) % span) + min;
    };

    lowerPadRefs.current.forEach((pad, index) => {
      if (!pad) return;
      pad.position.x = wrap(-0.94 + index * 0.235 - trackOffsetRef.current, -1.04, 1.04);
    });
    upperPadRefs.current.forEach((pad, index) => {
      if (!pad) return;
      pad.position.x = wrap(-0.82 + index * 0.235 + trackOffsetRef.current, -0.94, 0.94);
    });
    wheelRefs.current.forEach((wheel) => {
      if (wheel) wheel.rotation.z -= trackSpeed * delta * 2.4;
    });
  });

  return (
    <group position={[0, 0, side * 0.72]}>
      <RoundedBox args={[2.12, 0.54, 0.52]} radius={0.16} smoothness={8} position={[0, 0.03, 0]}>
        <meshStandardMaterial color="#11191f" roughness={0.68} metalness={0.22} />
      </RoundedBox>
      <RoundedBox args={[1.96, 0.32, 0.58]} radius={0.12} smoothness={8} position={[0, 0.16, 0]}>
        <meshStandardMaterial color="#26333b" roughness={0.48} metalness={0.28} />
      </RoundedBox>
      <RoundedBox args={[1.78, 0.2, 0.58]} radius={0.1} smoothness={8} position={[0, -0.18, 0]}>
        <meshStandardMaterial color="#070b0e" roughness={0.74} metalness={0.16} />
      </RoundedBox>
      {[-0.92, 0.92].map((x) => (
        <mesh key={`track-rounded-nose-${x}`} position={[x, -0.08, side * 0.01]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.33, 0.33, 0.62, 28]} />
          <meshStandardMaterial color="#0b1115" roughness={0.62} metalness={0.22} />
        </mesh>
      ))}

      {[-0.96, 0.96].map((x) => (
        <group
          key={`sprocket-${x}`}
          ref={(node) => {
            wheelRefs.current[x < 0 ? 0 : 1] = node;
          }}
          position={[x, 0.03, side * 0.025]}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.34, 0.34, 0.11, 32]} />
            <meshStandardMaterial color="#1f2b33" roughness={0.36} metalness={0.46} />
          </mesh>
          <mesh position={[0, 0, side * 0.065]}>
            <torusGeometry args={[0.29, 0.035, 10, 32]} />
            <meshStandardMaterial color="#0b1115" roughness={0.48} metalness={0.34} />
          </mesh>
          {Array.from({ length: 12 }, (_, tooth) => {
            const angle = (tooth / 12) * Math.PI * 2;
            return (
              <mesh
                key={`tooth-${tooth}`}
                position={[Math.cos(angle) * 0.34, Math.sin(angle) * 0.34, 0]}
                rotation={[0, 0, angle]}
              >
                <boxGeometry args={[0.12, 0.045, 0.14]} />
                <meshStandardMaterial color="#0b1115" roughness={0.46} metalness={0.38} />
              </mesh>
            );
          })}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.13, 18]} />
            <meshStandardMaterial color="#c2cbd1" roughness={0.22} metalness={0.6} />
          </mesh>
        </group>
      ))}
      {rollers.map((x, index) => (
        <group
          key={x}
          ref={(node) => {
            wheelRefs.current[index + 2] = node;
          }}
          position={[x, -0.06, side * 0.04]}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.12, 24]} />
            <meshStandardMaterial color="#26343c" roughness={0.36} metalness={0.44} />
          </mesh>
          <mesh position={[0, 0, side * 0.07]}>
            <torusGeometry args={[0.16, 0.018, 8, 24]} />
            <meshStandardMaterial color="#0b1115" roughness={0.42} metalness={0.36} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.105, 0.105, 0.135, 20]} />
            <meshStandardMaterial color="#e3e8eb" roughness={0.2} metalness={0.66} />
          </mesh>
        </group>
      ))}

      {lowerPads.map((index) => (
        <group
          key={`lower-pad-${index}`}
          ref={(node) => {
            lowerPadRefs.current[index] = node;
          }}
          position={[-0.94 + index * 0.235, -0.37, side * 0.02]}
        >
          <RoundedBox args={[0.18, 0.08, 0.68]} radius={0.035} smoothness={4}>
            <meshStandardMaterial color="#0b1115" roughness={0.66} metalness={0.22} />
          </RoundedBox>
          <RoundedBox args={[0.13, 0.035, 0.74]} radius={0.025} smoothness={4} position={[0, 0.055, 0]}>
            <meshStandardMaterial color="#18232b" roughness={0.58} metalness={0.28} />
          </RoundedBox>
          <RoundedBox args={[0.035, 0.035, 0.72]} radius={0.014} smoothness={4} position={[0.075, 0.082, 0]} rotation={[0, 0, 0.18]}>
            <meshStandardMaterial color="#2b3942" roughness={0.42} metalness={0.34} />
          </RoundedBox>
        </group>
      ))}
      {upperPads.map((index) => (
        <group
          key={`upper-pad-${index}`}
          ref={(node) => {
            upperPadRefs.current[index] = node;
          }}
          position={[-0.82 + index * 0.235, 0.34, side * 0.02]}
        >
          <RoundedBox args={[0.16, 0.06, 0.62]} radius={0.03} smoothness={4}>
            <meshStandardMaterial color="#1b2730" roughness={0.52} metalness={0.26} />
          </RoundedBox>
          <RoundedBox args={[0.11, 0.028, 0.66]} radius={0.02} smoothness={4} position={[0, 0.04, 0]}>
            <meshStandardMaterial color="#26343c" roughness={0.45} metalness={0.32} />
          </RoundedBox>
        </group>
      ))}
      {[-1, 1].map((end) =>
        [-0.18, 0.02, 0.22].map((y) => (
          <mesh
            key={`end-pad-${end}-${y}`}
            position={[end * 1.0, y, side * 0.02]}
            rotation={[0, 0, end * 0.22]}
          >
            <boxGeometry args={[0.12, 0.08, 0.64]} />
            <meshStandardMaterial color="#0b1115" roughness={0.66} metalness={0.22} />
          </mesh>
        )),
      )}

      <mesh position={[0, 0.43, side * 0.04]}>
        <boxGeometry args={[1.62, 0.055, 0.62]} />
        <meshStandardMaterial color="#6f7c86" roughness={0.24} metalness={0.5} />
      </mesh>
    </group>
  );
}

function BodyBrandDecal({
  texture,
  width,
  aspect,
  x,
  y,
  z = 0,
  renderOrder = 91,
}: {
  texture: THREE.Texture;
  width: number;
  aspect: number;
  x: number;
  y: number;
  z?: number;
  renderOrder?: number;
}) {
  const height = logoHeightForWidth(width, aspect);

  return (
    <group position={[x, y, z]}>
      <mesh
        position={[-0.01, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        renderOrder={renderOrder}
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          map={texture}
          transparent
          alphaTest={0.12}
          toneMapped={false}
          depthTest={false}
          depthWrite={false}
          side={THREE.FrontSide}
        />
      </mesh>
    </group>
  );
}

function RearBodyBrandMarks() {
  const [ykLogo, setYkLogo] = useState<THREE.Texture | null>(null);
  const [yanmarLogo, setYanmarLogo] = useState<THREE.Texture | null>(null);

  useLayoutEffect(() => {
    const ykTexture = createYkGeongiLabelTexture("horizontal");
    const yanmarTexture = createYanmarRearLabelTexture();
    if (ykTexture) setYkLogo(ykTexture);
    if (yanmarTexture) setYanmarLogo(yanmarTexture);
    return () => {
      ykTexture?.dispose();
      yanmarTexture?.dispose();
    };
  }, []);

  return (
    <>
      {ykLogo ? (
        <BodyBrandDecal
          texture={ykLogo}
          width={YK_REAR_BODY_WIDTH}
          aspect={YK_LABEL_ASPECT}
          x={REAR_BODY_PANEL_X}
          y={YK_REAR_BODY_Y}
          z={REAR_BODY_PANEL_Z}
          renderOrder={91}
        />
      ) : null}
      {yanmarLogo ? (
        <BodyBrandDecal
          texture={yanmarLogo}
          width={YANMAR_REAR_BODY_WIDTH}
          aspect={YANMAR_REAR_LOGO_ASPECT}
          x={REAR_BODY_PANEL_X}
          y={YANMAR_REAR_BODY_Y}
          z={YANMAR_REAR_BODY_Z}
          renderOrder={90}
        />
      ) : null}
    </>
  );
}

function ExcavatorBodyAssembly({
  velRef,
}: {
  velRef: React.MutableRefObject<HydraulicVelocity>;
}) {
  return (
    <group scale={[MINI_EXCAVATOR_BODY_LENGTH_SCALE, 1, MINI_EXCAVATOR_BODY_WIDTH_SCALE]}>
      <group position={[-0.72, 0.24, 0]}>
        {[-1, 1].map((side) => (
          <TankTrack key={side} side={side as 1 | -1} velRef={velRef} />
        ))}
        <RoundedBox args={[2.05, 0.22, 1.72]} radius={0.08} smoothness={6} position={[0.02, 0.47, 0]}>
          <meshStandardMaterial color="#2a353d" roughness={0.42} metalness={0.3} />
        </RoundedBox>
        <RoundedBox args={[1.78, 0.08, 1.42]} radius={0.045} smoothness={6} position={[0.02, 0.61, 0]}>
          <meshStandardMaterial color="#dfe6ea" roughness={0.24} metalness={0.34} />
        </RoundedBox>
      </group>

      <group position={[-0.52, 0.76, 0]}>
        <RoundedBox args={[1.48, 0.4, 1.74]} radius={0.14} smoothness={8} position={[-0.08, 0, 0]}>
          <meshStandardMaterial color="#f2f4f3" roughness={0.34} metalness={0.18} />
        </RoundedBox>
        {[-1, 1].map((side) => (
          <RoundedBox
            key={`premium-side-panel-${side}`}
            args={[0.76, 0.28, 0.055]}
            radius={0.035}
            smoothness={5}
            position={[-0.18, 0.02, side * 0.91]}
          >
            <meshStandardMaterial color="#e9eef2" roughness={0.24} metalness={0.28} />
          </RoundedBox>
        ))}
        <mesh position={[-0.18, 0.24, -0.91]}>
          <boxGeometry args={[0.86, 0.08, 0.045]} />
          <meshStandardMaterial color="#c7d0d8" roughness={0.22} metalness={0.46} />
        </mesh>
        <mesh position={[-0.18, 0.24, 0.91]}>
          <boxGeometry args={[0.86, 0.08, 0.045]} />
          <meshStandardMaterial color="#c7d0d8" roughness={0.22} metalness={0.46} />
        </mesh>
        <RoundedBox args={[0.52, 0.42, 1.54]} radius={0.12} smoothness={8} position={[0.48, 0.03, 0]}>
          <meshStandardMaterial color="#d92323" roughness={0.32} metalness={0.18} />
        </RoundedBox>
        {[-1, 1].map((side) => (
          <group key={`engine-vent-bank-${side}`} position={[0.49, 0.02, side * 0.795]}>
            {[-0.12, 0, 0.12].map((y, index) => (
              <mesh key={`vent-${index}`} position={[0, y, 0]}>
                <boxGeometry args={[0.38, 0.035, 0.035]} />
                <meshStandardMaterial color="#18212a" roughness={0.48} metalness={0.24} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[0.48, 0.27, -0.68]}>
          <boxGeometry args={[0.48, 0.055, 0.045]} />
          <meshStandardMaterial color="#ff6b56" roughness={0.22} metalness={0.16} />
        </mesh>
        <mesh position={[0.48, -0.21, -0.68]}>
          <boxGeometry args={[0.48, 0.045, 0.045]} />
          <meshStandardMaterial color="#7c1111" roughness={0.5} metalness={0.08} />
        </mesh>
        <mesh position={[-0.98, 0.08, 0]}>
          <boxGeometry args={[0.46, 0.48, 1.62]} />
          <meshStandardMaterial color="#cfd8dd" roughness={0.32} metalness={0.28} />
        </mesh>
        <mesh position={[-0.18, 0.24, -0.9]}>
          <boxGeometry args={[1.42, 0.08, 0.08]} />
          <meshStandardMaterial color="#d92323" roughness={0.24} metalness={0.18} />
        </mesh>
        <mesh position={[-0.18, -0.24, -0.9]}>
          <boxGeometry args={[1.22, 0.055, 0.08]} />
          <meshStandardMaterial color="#363f47" roughness={0.34} metalness={0.28} />
        </mesh>
        {[-0.88, -0.36, 0.18, 0.58].map((x) =>
          [-1, 1].map((side) => (
            <mesh key={`body-rivet-${x}-${side}`} position={[x, 0.28, side * 0.9]}>
              <sphereGeometry args={[0.035, 10, 8]} />
              <meshStandardMaterial color="#eef3f7" roughness={0.24} metalness={0.62} />
            </mesh>
          )),
        )}
      </group>

      <group position={[-1.28, 1.45, -0.36]}>
        <RoundedBox args={[1.28, 1.64, 1.08]} radius={0.12} smoothness={8} position={[0, 0.06, 0]}>
          <meshStandardMaterial color="#f3f5f3" roughness={0.3} metalness={0.2} />
        </RoundedBox>
        <mesh position={[-0.52, 0.06, 0.56]}>
          <boxGeometry args={[0.09, 1.42, 0.055]} />
          <meshStandardMaterial color="#d8e1e7" roughness={0.26} metalness={0.38} />
        </mesh>
        <mesh position={[0.56, 0.06, 0.56]}>
          <boxGeometry args={[0.08, 1.32, 0.055]} />
          <meshStandardMaterial color="#d8e1e7" roughness={0.26} metalness={0.38} />
        </mesh>
        <mesh position={[0.02, -0.42, 0.58]}>
          <boxGeometry args={[0.72, 0.05, 0.06]} />
          <meshStandardMaterial color="#1e2933" roughness={0.36} metalness={0.32} />
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
        <RoundedBox args={[1.42, 0.18, 1.18]} radius={0.08} smoothness={8} position={[0, 0.98, 0]}>
          <meshStandardMaterial color="#d82020" roughness={0.34} metalness={0.2} />
        </RoundedBox>
        <mesh position={[0.18, 1.11, -0.3]}>
          <boxGeometry args={[0.42, 0.08, 0.16]} />
          <meshStandardMaterial
            color="#fff8d8"
            emissive="#ffe7a3"
            emissiveIntensity={0.35}
            roughness={0.18}
            metalness={0.12}
          />
        </mesh>
        <mesh position={[-0.38, 1.11, -0.3]}>
          <boxGeometry args={[0.26, 0.08, 0.16]} />
          <meshStandardMaterial color="#111827" roughness={0.36} metalness={0.26} />
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
          <meshStandardMaterial color="#333e46" roughness={0.34} metalness={0.44} />
        </mesh>
        <mesh position={[-0.36, 0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.78, 0.78, 1.52, 40, 1, true]} />
          <meshStandardMaterial color="#101820" roughness={0.42} metalness={0.52} />
        </mesh>
        <RoundedBox args={[0.92, 0.7, 1.0]} radius={0.13} smoothness={8} position={[0.18, 0.36, 0]}>
          <meshStandardMaterial color="#d52222" roughness={0.3} metalness={0.18} />
        </RoundedBox>
        {[-1, 1].map((side) => (
          <group key={`tail-vent-${side}`} position={[0.02, 0.4, side * 0.53]}>
            {[-0.16, -0.04, 0.08, 0.2].map((y, index) => (
              <mesh key={`tail-slat-${index}`} position={[0, y, 0]}>
                <boxGeometry args={[0.46, 0.028, 0.04]} />
                <meshStandardMaterial color="#151f28" roughness={0.48} metalness={0.3} />
              </mesh>
            ))}
          </group>
        ))}
        <RoundedBox args={[0.36, 1.1, 0.62]} radius={0.08} smoothness={8} position={[0.48, 0.68, 0]}>
          <meshStandardMaterial color="#f1f3f2" roughness={0.32} metalness={0.22} />
        </RoundedBox>
        <RoundedBox args={[0.62, 0.5, 0.74]} radius={0.1} smoothness={8} position={[0.78, 0.46, 0]}>
          <meshStandardMaterial color="#ef3127" roughness={0.28} metalness={0.18} />
        </RoundedBox>
        <mesh position={[0.96, 0.74, -0.34]}>
          <boxGeometry args={[0.3, 0.05, 0.05]} />
          <meshStandardMaterial color="#ff8a70" roughness={0.18} metalness={0.14} />
        </mesh>
      </group>

      <group position={[0.96, 0.37, 0]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.16, 0.48, 2.45]} />
          <meshStandardMaterial color="#26343d" roughness={0.56} metalness={0.18} />
        </mesh>
        <mesh position={[0.22, -0.08, 0]} rotation={[0, 0, -0.08]}>
          <boxGeometry args={[0.28, 0.9, 2.58]} />
          <meshStandardMaterial color="#3b4852" roughness={0.58} metalness={0.16} />
        </mesh>
      </group>

      <group position={[1.72, 0.2, 0]}>
        <mesh>
          <boxGeometry args={[0.11, 0.54, 2.32]} />
          <meshStandardMaterial color="#9aa5af" roughness={0.32} metalness={0.52} />
        </mesh>
        <mesh position={[0.08, 0.18, 0]}>
          <boxGeometry args={[0.055, 0.11, 2.1]} />
          <meshStandardMaterial color="#d4dce3" roughness={0.22} metalness={0.68} />
        </mesh>
      </group>

      {[-1, 1].map((side) => (
        <group key={`mirror-${side}`} position={[-1.35, 1.72, side * 0.72]}>
          <mesh rotation={[0, side * 0.35, 0]}>
            <boxGeometry args={[0.04, 0.18, 0.28]} />
            <meshStandardMaterial color="#1a222c" roughness={0.34} metalness={0.42} />
          </mesh>
          <mesh position={[side * 0.03, 0, side * 0.16]} rotation={[0, side * 0.35, 0]}>
            <boxGeometry args={[0.02, 0.14, 0.22]} />
            <meshStandardMaterial color="#8ed4e8" roughness={0.08} metalness={0.24} transparent opacity={0.75} />
          </mesh>
        </group>
      ))}

      {[-0.58, 0.32].map((x) => (
        <mesh key={`headlight-${x}`} position={[x, 0.44, -0.94]}>
          <boxGeometry args={[0.18, 0.26, 0.08]} />
          <meshStandardMaterial
            color="#fff8eb"
            emissive="#ffe9b0"
            emissiveIntensity={0.62}
            roughness={0.18}
            metalness={0.12}
          />
        </mesh>
      ))}

      <mesh position={[-1.08, 1.34, 0.5]} rotation={[0.42, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.07, 0.68, 12]} />
        <meshStandardMaterial color="#2f3840" roughness={0.36} metalness={0.58} />
      </mesh>
      <mesh position={[-1.08, 1.68, 0.5]}>
        <sphereGeometry args={[0.07, 12, 10]} />
        <meshStandardMaterial color="#1a2028" roughness={0.5} metalness={0.3} />
      </mesh>

      <mesh position={[-1.42, 0.92, 0]}>
        <boxGeometry args={[0.48, 0.72, 1.52]} />
        <meshStandardMaterial color="#1f262e" roughness={0.44} metalness={0.34} />
      </mesh>
      <mesh position={[-1.42, 1.02, 0.82]}>
        <boxGeometry args={[0.42, 0.08, 0.08]} />
        <meshStandardMaterial color="#ef3127" roughness={0.28} metalness={0.18} />
      </mesh>

      {[-1, 1].map((side) => (
        <mesh key={`rail-${side}`} position={[-1.18, 1.58, side * 0.58]}>
          <boxGeometry args={[0.04, 0.72, 0.04]} />
          <meshStandardMaterial color="#c8d0d8" roughness={0.24} metalness={0.62} />
        </mesh>
      ))}

      <RearBodyBrandMarks />
    </group>
  );
}

function ExcavatorArm({
  simRef,
  velRef,
  auxiliaryRef,
  inputRef,
  showBody,
}: {
  simRef: React.MutableRefObject<ExcavatorSimState>;
  velRef: React.MutableRefObject<HydraulicVelocity>;
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
  const [ykBoomLogo, setYkBoomLogo] = useState<THREE.Texture | null>(null);

  useLayoutEffect(() => {
    configureDecalTexture(yanmarLogo);
  }, [yanmarLogo]);

  useLayoutEffect(() => {
    const texture = createYkGeongiLabelTexture("horizontal");
    if (!texture) return;
    setYkBoomLogo(texture);
    return () => texture.dispose();
  }, []);

  const boomLen = 3;
  const armLen = 2.5;
  const bucketLen = 1.2;
  const armRootY = showBody ? 1.0 : 0.92;

  useFrame(() => {
    const g = groupRef.current;
    const s = simRef.current;
    if (!g) return;
    const terrainY = showBody ? EXCAVATOR_FIXED_VISUAL_Y : 0;
    g.position.set(s.posX, terrainY, s.posZ);
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
          <ExcavatorBodyAssembly velRef={velRef} />
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
            logo={ykBoomLogo ?? undefined}
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
}: {
  simRef: React.MutableRefObject<ExcavatorSimState>;
  mode: CameraMode;
}) {
  useFrame(({ camera }) => {
    const s = simRef.current;
    const facing = s.heading + s.swing;
    const forwardX = Math.sin(facing);
    const forwardZ = Math.cos(facing);
    const sideX = Math.cos(facing);
    const sideZ = -Math.sin(facing);
    const persp = camera as THREE.PerspectiveCamera;

    if (mode === 3) {
      // First-person view: frame the boom so its root sits visually on the control deck.
      const camY = 2.72;
      const lookY = 1.68;
      const back = 0.96;
      const lookAhead = 5.1;
      const side = 0.36;
      const fov = 54;
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

    if (mode === 1) {
      camera.position.set(
        s.posX - forwardX * 5.9 + sideX * 2.75,
        3.85,
        s.posZ - forwardZ * 5.9 + sideZ * 2.75,
      );
      camera.lookAt(
        s.posX + forwardX * 2.9 - sideX * 0.45,
        1.55,
        s.posZ + forwardZ * 2.9 - sideZ * 0.45,
      );
      return;
    }

    camera.position.set(
      s.posX - forwardX * 11.5 + sideX * 6.2,
      6.2,
      s.posZ - forwardZ * 11.5 + sideZ * 6.2,
    );
    camera.lookAt(
      s.posX + forwardX * 3.9 - sideX * 0.7,
      1.55,
      s.posZ + forwardZ * 3.9 - sideZ * 0.7,
    );
  });
  return null;
}

// 굴착 구역 밖(이동로): 버킷이 지면 위에 유지. 굴착 구역 안에서만 깊게 파고들 수 있음.

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
  autoPoseRef,
  tutorialDumpRef,
  digFeedbackRef,
  dumpTruckStateRef,
  dumpTruckPoseRef,
  onProgress,
  onDumpScore,
  onSimTick,
}: ExcavatorSceneProps) {
  const runtimeRef = useRef(createSimLoopRuntime());
  const dustRef = useRef<THREE.Group>(null);
  const dumpSoilVisualRef = useRef<DumpSoilVisualState>(runtimeRef.current.dumpSoilVisual);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    tickExcavatorSim({
      dt,
      sim: simRef.current,
      vel: velRef.current,
      terrain: terrainRef.current,
      score: scoreRef.current,
      mode: modeRef.current,
      stats: equipmentStatsRef.current,
      allowed: allowedRef.current,
      auxiliary: auxiliaryRef.current,
      autoPose: autoPoseRef.current,
      rawInput: inputRef.current,
      tutorialDump: tutorialDumpRef,
      digFeedback: digFeedbackRef.current,
      dumpTruckState: dumpTruckStateRef.current,
      dumpTruckPose: dumpTruckPoseRef.current,
      runtime: runtimeRef.current,
      onProgress,
      onDumpScore,
      onSimTick,
    });

    const dust = runtimeRef.current.digDust;
    if (dustRef.current) {
      if (dust.active) {
        dustRef.current.visible = true;
        dustRef.current.position.set(dust.x, dust.y, dust.z);
      } else {
        dustRef.current.visible = false;
      }
    }
    dumpSoilVisualRef.current = runtimeRef.current.dumpSoilVisual;
  });

  return (
    <>
      <DigDustCloud dustRef={dustRef} digFeedbackRef={digFeedbackRef} />
      <DumpSoilParticles visualRef={dumpSoilVisualRef} />
    </>
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
            <ringGeometry args={[zone.radius - 0.22, zone.radius + 0.18, 64]} />
            <meshBasicMaterial color="#ffb300" transparent opacity={0.92} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[zone.x, 0.24, zone.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[zone.radius - 1.0, zone.radius - 0.72, 64]} />
            <meshBasicMaterial color="#fff2a8" transparent opacity={0.58} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[zone.x, 0.26, zone.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.5, 3.2, 36]} />
            <meshBasicMaterial color="#fff3c4" transparent opacity={0.7} side={THREE.DoubleSide} />
          </mesh>
          <Text
            position={[zone.x, 0.34, zone.z - zone.radius - 1.25]}
            rotation={[-Math.PI / 2, 0, Math.PI]}
            fontSize={1.9}
            color="#fff7c7"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.08}
            outlineColor="#6d3e00"
          >
            {digZoneLabel(zone.id)}
          </Text>
        </group>
      ))}
      <mesh position={[DUMP_ZONE.x, 0.12, DUMP_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[DUMP_ZONE.radius, 40]} />
        <meshBasicMaterial color="#1b5e20" transparent opacity={0.16} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[DUMP_ZONE.x, 0.2, DUMP_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[DUMP_ZONE.radius - 0.22, DUMP_ZONE.radius + 0.18, 48]} />
        <meshBasicMaterial color="#66bb6a" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[DUMP_ZONE.x, 0.24, DUMP_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[DUMP_ZONE.radius - 0.9, DUMP_ZONE.radius - 0.62, 48]} />
        <meshBasicMaterial color="#d5ffd9" transparent opacity={0.52} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[DUMP_ZONE.x, 0.25, DUMP_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[DUMP_TRUCK_BED.width + 0.6, DUMP_TRUCK_BED.depth + 0.6, 0.08]} />
        <meshBasicMaterial color="#a5d6a7" transparent opacity={0.55} />
      </mesh>
      <mesh
        position={[DUMP_TRUCK_BED.centerX, 0.28, DUMP_TRUCK_BED.centerZ]}
        rotation={[-Math.PI / 2, 0, DUMP_TRUCK_BED.rotation]}
      >
        <boxGeometry args={[DUMP_TRUCK_BED.width, DUMP_TRUCK_BED.depth, 0.08]} />
        <meshBasicMaterial color="#b8ffba" transparent opacity={0.35} />
      </mesh>
      <Text
        position={[DUMP_ZONE.x, 0.34, DUMP_ZONE.z - DUMP_ZONE.radius - 1.2]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
        fontSize={1.65}
        color="#d7ffd9"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.08}
        outlineColor="#0c3d16"
      >
        DUMP
      </Text>
    </>
  );
}

interface NavigationTarget {
  label: "DIG" | "DUMP";
  x: number;
  z: number;
  color: string;
  outline: string;
  distance: number;
}

function NavigationGuide({
  simRef,
  terrainRef,
}: {
  simRef: React.MutableRefObject<ExcavatorSimState>;
  terrainRef: React.MutableRefObject<TerrainData>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const targetRef = useRef<NavigationTarget | null>(null);
  const [target, setTarget] = useState<NavigationTarget | null>(null);
  const updateRef = useRef(0);
  targetRef.current = target;

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (now - updateRef.current >= 0.12) {
      updateRef.current = now;

      const sim = simRef.current;
      const zones = getActiveDigZones(terrainRef.current);
      const nearestDig =
        zones
          .map((zone) => ({
            zone,
            distance: Math.hypot(zone.x - sim.posX, zone.z - sim.posZ),
          }))
          .sort((a, b) => a.distance - b.distance)[0]?.zone ?? DIG_ZONE;
      const inDig = zones.some(
        (zone) => Math.hypot(zone.x - sim.posX, zone.z - sim.posZ) < zone.radius,
      );
      const inDump = isInDumpZone(sim.posX, sim.posZ);
      const next =
        inDig || (!inDump && sim.bucketLoad > 0.08)
          ? {
              label: "DUMP" as const,
              x: DUMP_ZONE.x,
              z: DUMP_ZONE.z,
              color: "#8cff91",
              outline: "#0f421b",
            }
          : {
              label: "DIG" as const,
              x: nearestDig.x,
              z: nearestDig.z,
              color: "#ffd25a",
              outline: "#603a00",
            };

      const distance = Math.max(0, Math.hypot(next.x - sim.posX, next.z - sim.posZ));
      setTarget((current) =>
        current?.label === next.label &&
        Math.abs(current.x - next.x) < 0.1 &&
        Math.abs(current.z - next.z) < 0.1 &&
        Math.abs(current.distance - distance) < 0.5
          ? current
          : { ...next, distance },
      );
    }

    const group = groupRef.current;
    const activeTarget = targetRef.current;
    if (!group || !activeTarget) {
      if (group) group.visible = false;
      return;
    }

    const sim = simRef.current;
    const dx = activeTarget.x - sim.posX;
    const dz = activeTarget.z - sim.posZ;
    const length = Math.max(0.001, Math.hypot(dx, dz));
    const guideDistance = Math.min(8, Math.max(4.2, length * 0.28));
    const x = sim.posX + (dx / length) * guideDistance;
    const z = sim.posZ + (dz / length) * guideDistance;
    const angle = Math.atan2(dx, dz);
    const groundY = sampleHeight(terrainRef.current, x, z);

    group.visible = true;
    group.position.set(x, groundY + 0.52, z);
    group.rotation.set(0, angle, 0);
  });

  if (!target) return null;

  const meterText = `${target.label} ${Math.round(target.distance)}m`;
  const guideMaterialProps = {
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  } as const;

  return (
    <group ref={groupRef} renderOrder={1200}>
      <mesh position={[0, 0.02, 0.15]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1201}>
        <cylinderGeometry args={[0.1, 0.1, 2.25, 12]} />
        <meshBasicMaterial color={target.color} opacity={0.88} {...guideMaterialProps} />
      </mesh>
      <mesh position={[0, 0.02, 1.55]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1201}>
        <coneGeometry args={[0.42, 0.92, 24]} />
        <meshBasicMaterial color={target.color} opacity={0.96} {...guideMaterialProps} />
      </mesh>
      <Text
        position={[0, 0.1, -1.15]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
        fontSize={0.82}
        color={target.color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor={target.outline}
        renderOrder={1202}
        material-depthTest={false}
        material-depthWrite={false}
        material-toneMapped={false}
      >
        {meterText}
      </Text>
    </group>
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
      <mesh position={[0, 0.72, 0.31]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.64, 0.08, 0.04]} />
        <meshStandardMaterial color="#fff8e7" roughness={0.35} emissive="#fff4d0" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, 0.5, 0.31]}>
        <boxGeometry args={[0.58, 0.07, 0.04]} />
        <meshStandardMaterial color="#1f2937" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.66, 0]}>
        <cylinderGeometry args={[0.22, 0.27, 0.08, 16]} />
        <meshStandardMaterial color="#fff3d0" roughness={0.45} />
      </mesh>
    </group>
  );
}

function DumpTruckWorldHud({
  stateRef,
  statsRef,
}: {
  stateRef: React.MutableRefObject<DumpTruckRuntimeState>;
  statsRef: React.RefObject<YanmarEquipmentStats>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const labelRef = useRef<THREE.Object3D & { text?: string }>(null);

  useFrame(() => {
    const state = stateRef.current;
    const stats = statsRef.current;
    const capacity = stats?.truckCapacityUnits ?? 3000;
    const cooldownSec = stats?.truckCooldownSec ?? 600;
    const pose = getDumpTruckPose(state);
    const group = groupRef.current;
    const label = labelRef.current;

    if (group) {
      if (state.phase === "cooldown") {
        group.position.set(DUMP_TRUCK_BED.x, 3.35, DUMP_TRUCK_BED.z);
      } else {
        group.position.set(pose.groupX, 3.35, pose.groupZ);
      }
      group.visible =
        state.phase === "cooldown" ||
        isDumpTruckVisible(state) ||
        shouldShowDumpTruckReturnTimer(state);
    }

    if (!label || !("text" in label)) return;

    if (shouldShowDumpTruckReturnTimer(state)) {
      label.text = `복귀 ${formatDumpTruckReturnTime(
        getDumpTruckReturnEtaSec(state, cooldownSec),
      )}`;
      return;
    }

    label.text = `${Math.round(state.fillUnits)}/${capacity}`;
  });

  return (
    <group ref={groupRef}>
      <Billboard follow>
        <Text
          ref={labelRef}
          fontSize={0.52}
          color="#f8fafc"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.045}
          outlineColor="#0f172a"
        >
          0/3000
        </Text>
      </Billboard>
    </group>
  );
}

function DumpTruck({
  stateRef,
  statsRef,
}: {
  stateRef: React.MutableRefObject<DumpTruckRuntimeState>;
  statsRef: React.RefObject<YanmarEquipmentStats>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const fillMeshRef = useRef<THREE.Mesh>(null);
  const exhaustRef = useRef<THREE.Mesh>(null);
  const wheelRefs = useRef<(THREE.Group | null)[]>([]);
  const prevPoseRef = useRef({ x: 0, z: 0 });
  const wheelPositions = [
    { x: -2.7, z: -1.46 },
    { x: -1.75, z: -1.46 },
    { x: 2.45, z: -1.46 },
    { x: -2.7, z: 1.46 },
    { x: -1.75, z: 1.46 },
    { x: 2.45, z: 1.46 },
  ];

  useFrame(() => {
    const group = groupRef.current;
    const body = bodyRef.current;
    if (!group || !body) return;
    const state = stateRef.current;
    const pose = getDumpTruckPose(state);
    const motion = getDumpTruckMotionProgress(state);
    group.position.set(pose.groupX, 0.55, pose.groupZ);
    group.rotation.y = DUMP_TRUCK_BED.rotation + pose.rotationYOffset;
    group.visible = isDumpTruckVisible(state);

    body.position.y = 0.78;
    body.rotation.z = 0;
    body.rotation.y = 0;

    const exhaust = exhaustRef.current;
    if (exhaust?.material instanceof THREE.MeshStandardMaterial) {
      exhaust.material.emissiveIntensity =
        motion.kind === "engineStart"
          ? 0.55 + Math.sin(state.phaseElapsed * 22) * 0.35
          : motion.kind === "departing" || motion.kind === "arriving"
            ? 0.35
            : 0.12;
    }

    if (motion.kind === "engineStart") {
      const ramp = Math.min(1, motion.t * 2.4);
      body.position.y = 0.78 + Math.sin(state.phaseElapsed * 28) * 0.022 * ramp;
      body.rotation.z = Math.sin(state.phaseElapsed * 19) * 0.012 * ramp;
    } else if (
      motion.kind === "arriving" &&
      motion.sub === "park"
    ) {
      const parkT = (motion.t - 0.86) / 0.14;
      const settle = Math.sin(parkT * Math.PI) * (1 - parkT);
      body.rotation.y = settle * 0.018;
      body.position.y = 0.78 - settle * 0.012;
    }

    const travelDelta = Math.hypot(
      pose.groupX - prevPoseRef.current.x,
      pose.groupZ - prevPoseRef.current.z,
    );
    prevPoseRef.current.x = pose.groupX;
    prevPoseRef.current.z = pose.groupZ;
    const wheelSpin =
      motion.kind === "departing" || motion.kind === "arriving"
        ? travelDelta * 0.42
        : motion.kind === "engineStart"
          ? Math.sin(state.phaseElapsed * 16) * 0.004
          : 0;
    for (const wheel of wheelRefs.current) {
      if (wheel) wheel.rotation.z -= wheelSpin;
    }

    const fillMesh = fillMeshRef.current;
    if (fillMesh) {
      const capacity = statsRef.current?.truckCapacityUnits ?? 3000;
      const fillRatio = getDumpTruckFillRatio(state, capacity);
      const visible = fillRatio > 0.02 && isDumpTruckVisible(state);
      fillMesh.visible = visible;
      if (visible) {
        fillMesh.position.set(-0.65, 0.42 + fillRatio * 0.35, 0);
        fillMesh.scale.set(1, 0.8 + fillRatio * 1.4, 1);
      }
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={bodyRef} position={[0.3, 0.78, 0]}>
        <RoundedBox args={[5.45, 0.32, 2.72]} radius={0.08} smoothness={6} position={[-0.65, 0.05, 0]}>
          <meshStandardMaterial color="#171c22" roughness={0.38} metalness={0.48} />
        </RoundedBox>
        <mesh position={[-0.65, 0.25, 0]}>
          <boxGeometry args={[4.96, 0.18, 2.42]} />
          <meshStandardMaterial color="#353c44" roughness={0.42} metalness={0.42} />
        </mesh>
        <mesh ref={fillMeshRef} visible={false} position={[-0.65, 0.42, 0]}>
          <boxGeometry args={[4.2, 0.12, 2.05]} />
          <meshStandardMaterial color="#6d4c2c" roughness={0.88} metalness={0.04} />
        </mesh>
        <mesh position={[-0.65, 0.92, 0]}>
          <boxGeometry args={[4.62, 1.05, 2.18]} />
          <meshStandardMaterial color="#8f1215" roughness={0.42} metalness={0.24} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={`bed-side-${side}`}>
            <mesh position={[-0.65, 0.92, side * 1.46]}>
              <boxGeometry args={[5.36, 1.18, 0.2]} />
              <meshStandardMaterial color="#d9272b" roughness={0.3} metalness={0.3} />
            </mesh>
            <mesh position={[-0.65, 1.58, side * 1.46]}>
              <boxGeometry args={[5.5, 0.22, 0.24]} />
              <meshStandardMaterial color="#ef3438" roughness={0.25} metalness={0.34} />
            </mesh>
            <mesh position={[-0.65, 0.3, side * 1.5]}>
              <boxGeometry args={[5.4, 0.16, 0.24]} />
              <meshStandardMaterial color="#611013" roughness={0.34} metalness={0.3} />
            </mesh>
            {[-2.75, -1.8, -0.85, 0.1, 1.05, 1.75].map((x) => (
              <mesh key={`rib-${side}-${x}`} position={[x, 0.92, side * 1.58]}>
                <boxGeometry args={[0.14, 1.12, 0.16]} />
                <meshStandardMaterial color="#a8171b" roughness={0.32} metalness={0.3} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[-3.38, 1.58, 0]}>
          <boxGeometry args={[0.24, 0.22, 3.12]} />
          <meshStandardMaterial color="#ef3438" roughness={0.25} metalness={0.34} />
        </mesh>
        <mesh position={[1.92, 1.58, 0]}>
          <boxGeometry args={[0.24, 0.22, 3.12]} />
          <meshStandardMaterial color="#ef3438" roughness={0.25} metalness={0.34} />
        </mesh>
        <mesh position={[-3.38, 0.88, 0]}>
          <boxGeometry args={[0.22, 1.24, 3.08]} />
          <meshStandardMaterial color="#b51c20" roughness={0.34} metalness={0.28} />
        </mesh>
        <mesh position={[1.92, 0.88, 0]}>
          <boxGeometry args={[0.22, 1.24, 3.08]} />
          <meshStandardMaterial color="#b51c20" roughness={0.34} metalness={0.28} />
        </mesh>
        <RoundedBox args={[1.72, 1.62, 2.44]} radius={0.16} smoothness={8} position={[2.28, 0.64, 0]}>
          <meshStandardMaterial color="#df2428" roughness={0.28} metalness={0.3} />
        </RoundedBox>
        <RoundedBox args={[1.84, 0.22, 2.58]} radius={0.08} smoothness={6} position={[2.26, 1.5, 0]}>
          <meshStandardMaterial color="#272d34" roughness={0.3} metalness={0.48} />
        </RoundedBox>
        <mesh position={[2.58, 1.38, -0.52]} rotation={[0, -0.12, 0]}>
          <boxGeometry args={[0.08, 0.58, 0.82]} />
          <CabWindowMaterial />
        </mesh>
        <mesh position={[2.25, 1.2, -1.22]}>
          <boxGeometry args={[0.9, 0.58, 0.08]} />
          <CabWindowMaterial />
        </mesh>
        <mesh position={[2.25, 1.2, 1.22]}>
          <boxGeometry args={[0.9, 0.58, 0.08]} />
          <CabWindowMaterial />
        </mesh>
        <mesh position={[3.16, 0.83, 0]}>
          <boxGeometry args={[0.1, 0.72, 1.24]} />
          <meshStandardMaterial color="#14191f" roughness={0.32} metalness={0.5} />
        </mesh>
        {[-0.38, 0, 0.38].map((z) => (
          <mesh key={`grille-${z}`} position={[3.23, 0.83, z]}>
            <boxGeometry args={[0.06, 0.08, 0.28]} />
            <meshStandardMaterial color="#3c444d" roughness={0.28} metalness={0.58} />
          </mesh>
        ))}
        {[-0.82, 0.82].map((z) => (
          <group key={`headlight-${z}`}>
            <RoundedBox args={[0.13, 0.28, 0.42]} radius={0.04} smoothness={4} position={[3.2, 0.36, z]}>
              <meshStandardMaterial color="#dbe7ed" emissive="#d8f3ff" emissiveIntensity={0.32} roughness={0.14} metalness={0.46} />
            </RoundedBox>
            <mesh position={[2.55, 1.15, z > 0 ? 1.43 : -1.43]}>
              <boxGeometry args={[0.12, 0.42, 0.12]} />
              <meshStandardMaterial color="#232a31" roughness={0.34} metalness={0.48} />
            </mesh>
            <RoundedBox args={[0.22, 0.36, 0.12]} radius={0.04} smoothness={4} position={[2.55, 1.34, z > 0 ? 1.5 : -1.5]}>
              <meshStandardMaterial color="#11171c" roughness={0.22} metalness={0.5} />
            </RoundedBox>
          </group>
        ))}
        <RoundedBox args={[0.28, 0.36, 2.74]} radius={0.06} smoothness={6} position={[3.18, 0.06, 0]}>
          <meshStandardMaterial color="#20262d" roughness={0.38} metalness={0.52} />
        </RoundedBox>
        <mesh position={[2.86, 0.05, 0]}>
          <boxGeometry args={[1.85, 0.34, 2.68]} />
          <meshStandardMaterial color="#252c33" roughness={0.38} metalness={0.46} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={`bed-hydraulic-${side}`}>
            <mesh position={[1.55, 0.72, side * 1.18]} rotation={[0, 0, -0.45]}>
              <cylinderGeometry args={[0.1, 0.12, 1.55, 16]} />
              <meshStandardMaterial color="#242a30" roughness={0.28} metalness={0.58} />
            </mesh>
            <mesh position={[1.24, 1.05, side * 1.18]} rotation={[0, 0, -0.45]}>
              <cylinderGeometry args={[0.055, 0.055, 1.12, 14]} />
              <meshStandardMaterial color="#aeb7bd" roughness={0.18} metalness={0.78} />
            </mesh>
          </group>
        ))}
        <mesh ref={exhaustRef} position={[2.97, 1.52, 1.05]}>
          <cylinderGeometry args={[0.08, 0.1, 0.72, 16]} />
          <meshStandardMaterial color="#f59e0b" emissive="#fbbf24" emissiveIntensity={0.12} />
        </mesh>
        <mesh position={[2.16, 0.14, 1.38]}>
          <boxGeometry args={[1.64, 0.2, 0.12]} />
          <meshStandardMaterial color="#4b5563" roughness={0.38} metalness={0.42} />
        </mesh>
        <mesh position={[2.16, 0.14, -1.38]}>
          <boxGeometry args={[1.64, 0.2, 0.12]} />
          <meshStandardMaterial color="#4b5563" roughness={0.38} metalness={0.42} />
        </mesh>
      </group>

      {wheelPositions.map(({ x, z }, index) => (
        <group
          key={`${x}:${z}`}
          position={[x, 0.4, z]}
        >
          <group
            ref={(node) => {
              wheelRefs.current[index] = node;
            }}
          >
            <group rotation={[Math.PI / 2, 0, 0]}>
              <mesh scale={[1, z > 0 ? 1 : -1, 1]}>
                <cylinderGeometry args={[0.5, 0.5, 0.36, 36]} />
                <meshStandardMaterial color="#11161b" roughness={0.58} metalness={0.2} />
              </mesh>
              <mesh>
                <cylinderGeometry args={[0.28, 0.28, 0.4, 24]} />
                <meshStandardMaterial color="#aeb7bd" roughness={0.22} metalness={0.7} />
              </mesh>
              <mesh>
                <cylinderGeometry args={[0.12, 0.12, 0.43, 16]} />
                <meshStandardMaterial color="#252c32" roughness={0.3} metalness={0.6} />
              </mesh>
            </group>
            {[0, Math.PI / 4, Math.PI / 2, (Math.PI * 3) / 4].map((rotation) => (
              <mesh key={`lug-${rotation}`} rotation={[0, 0, rotation]}>
                <boxGeometry args={[0.08, 0.78, 0.03]} />
                <meshStandardMaterial color="#2b333a" roughness={0.62} metalness={0.18} />
              </mesh>
            ))}
          </group>
          <RoundedBox args={[0.92, 0.2, 0.5]} radius={0.08} smoothness={6} position={[0, 0.42, z > 0 ? -0.08 : 0.08]}>
            <meshStandardMaterial color="#202a32" roughness={0.56} metalness={0.22} />
          </RoundedBox>
        </group>
      ))}

      <Text
        position={[0.05, 2.65, -1.88]}
        rotation={[0, 0, 0]}
        fontSize={0.72}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.035}
        outlineColor="#8a1010"
      >
        DUMP HERE
      </Text>
    </group>
  );
}

function WorksiteSetDressing({
  dumpTruckStateRef,
  equipmentStatsRef,
}: {
  dumpTruckStateRef: React.MutableRefObject<DumpTruckRuntimeState>;
  equipmentStatsRef: React.RefObject<YanmarEquipmentStats>;
}) {
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
      <DumpTruck stateRef={dumpTruckStateRef} statsRef={equipmentStatsRef} />
      <DumpTruckWorldHud stateRef={dumpTruckStateRef} statsRef={equipmentStatsRef} />
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
      <fog attach="fog" args={["#b8dcf1", 110, 320]} />
      <hemisphereLight args={["#e8f7ff", "#c58b54", 0.78]} />
      <ambientLight intensity={0.48} />
      <directionalLight
        position={[22, 34, -28]}
        intensity={2.45}
        color="#fff2c1"
        castShadow={false}
      />
      <directionalLight position={[-18, 22, 36]} intensity={0.42} color="#b8d4f0" />
      <pointLight position={[34, 31, -56]} intensity={0.62} color="#ffe28a" distance={95} />
      <SunnySky />
      <TerrainMesh terrainRef={props.terrainRef} />
      <MapSiteDecor terrainRef={props.terrainRef} />
      <TerrainRockScatter terrainRef={props.terrainRef} />
      <WorksiteSetDressing
        dumpTruckStateRef={props.dumpTruckStateRef}
        equipmentStatsRef={props.equipmentStatsRef}
      />
      <ZoneMarkers terrainRef={props.terrainRef} />
      <ExcavatorArm
        simRef={props.simRef}
        velRef={props.velRef}
        auxiliaryRef={props.auxiliaryRef}
        inputRef={props.inputRef}
        showBody={props.cameraMode !== 3}
      />
      <NavigationGuide simRef={props.simRef} terrainRef={props.terrainRef} />
      <WaypointMarker tutorialStepRef={props.tutorialStepRef} />
      <AuxiliarySceneEffects auxiliaryRef={props.auxiliaryRef} />
      <GameCamera
        simRef={props.simRef}
        mode={props.cameraMode}
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
    bucket: 0.85,
    posX: -18,
    posZ: -22,
    heading: 0,
    bucketLoad: 0,
  };
}

export function createInitialTerrain(dynamicDigZones = false): TerrainData {
  return createTerrain(-48, -48, dynamicDigZones);
}
