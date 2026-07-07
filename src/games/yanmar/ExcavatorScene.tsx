"use client";

/* eslint-disable react-hooks/refs */

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import type { AuxiliaryControlState, ExcavatorControlState, ControlMask } from "./controls";
import {
  applyControls,
  canDumpBucket,
  canLoadBucket as isBucketCurled,
  filterInput,
  type HydraulicVelocity,
} from "./controls";
import {
  createTerrain,
  digAt,
  isInDigZone,
  isInDumpZone,
  sampleHeight,
  type TerrainData,
  DIG_ZONE,
  DUMP_ZONE,
} from "./terrain";
import {
  getBucketTipWorld,
  type DigFeedback,
} from "./bucket";
import type { DiggingScoreState } from "./scoring";
import type { GameMode, TutorialStep } from "./tutorial";

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

interface ExcavatorSceneProps {
  inputRef: React.RefObject<ExcavatorControlState>;
  simRef: React.MutableRefObject<ExcavatorSimState>;
  velRef: React.MutableRefObject<HydraulicVelocity>;
  terrainRef: React.MutableRefObject<TerrainData>;
  scoreRef: React.MutableRefObject<DiggingScoreState>;
  modeRef: React.RefObject<GameMode>;
  allowedRef: React.RefObject<ControlMask>;
  auxiliaryRef: React.RefObject<AuxiliaryControlState>;
  tutorialStepRef: React.RefObject<TutorialStep | null>;
  tutorialDumpRef: React.MutableRefObject<number>;
  digFeedbackRef: React.MutableRefObject<DigFeedback>;
  onProgress: (dumped: number, progress: number) => void;
  onTutorialTick: () => void;
}

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
    const c0 = new THREE.Color("#b78958");
    const cDug = new THREE.Color("#5b351a");
    const cMound = new THREE.Color("#d29b5b");

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
      <meshStandardMaterial vertexColors roughness={0.82} metalness={0.03} />
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
}: {
  length: number;
  height: number;
  sideDepth: number;
  logo?: THREE.Texture;
  logoWidth?: number;
  logoHeight?: number;
  logoX?: number;
}) {
  return (
    <>
      {[1, -1].map((side) => (
        <group key={side} position={[0, 0, side * sideDepth]}>
          <mesh position={[length / 2, 0, 0]}>
            <boxGeometry args={[length, height, 0.08]} />
            <meshStandardMaterial color="#d92121" roughness={0.42} metalness={0.12} />
          </mesh>
          <mesh position={[length / 2, height * 0.34, 0.046]}>
            <boxGeometry args={[length * 0.82, height * 0.12, 0.025]} />
            <meshStandardMaterial color="#ff5a44" roughness={0.38} metalness={0.12} />
          </mesh>
          <mesh position={[length / 2, -height * 0.36, 0.048]}>
            <boxGeometry args={[length * 0.72, height * 0.1, 0.025]} />
            <meshStandardMaterial color="#941515" roughness={0.48} metalness={0.08} />
          </mesh>
          <mesh position={[length * 0.18, height * 0.05, 0.052]} rotation={[0, 0, -0.34]}>
            <boxGeometry args={[length * 0.18, height * 0.16, 0.028]} />
            <meshStandardMaterial color="#11151a" roughness={0.65} metalness={0.1} />
          </mesh>
          {logo && logoX != null && (
            <mesh position={[logoX, 0.04, side * 0.056]} scale={[-1, 1, 1]}>
              <planeGeometry args={[logoWidth, logoHeight]} />
              <meshBasicMaterial
                map={logo}
                transparent
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
        </group>
      ))}
      <mesh position={[length / 2, 0, 0]}>
        <boxGeometry args={[length * 0.92, height * 0.72, sideDepth * 1.65]} />
        <meshStandardMaterial color="#b51a1a" roughness={0.5} metalness={0.08} />
      </mesh>
    </>
  );
}

function createLabelTexture(text: string) {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "900 76px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(255,255,255,0.96)";
  ctx.strokeText(text, 256, 80);
  ctx.fillStyle = "#0b6edc";
  ctx.fillText(text.slice(0, 2), 184, 80);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text.slice(2), 310, 80);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function ExcavatorArm({
  simRef,
  auxiliaryRef,
}: {
  simRef: React.MutableRefObject<ExcavatorSimState>;
  auxiliaryRef: React.RefObject<AuxiliaryControlState>;
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
  const bucketSideShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.38, 0.18);
    shape.quadraticCurveTo(-0.02, 0.38, 0.36, 0.2);
    shape.lineTo(0.86, -0.36);
    shape.quadraticCurveTo(0.42, -0.66, -0.2, -0.38);
    shape.quadraticCurveTo(-0.42, -0.18, -0.38, 0.18);
    return shape;
  }, []);

  const boomLen = 3;
  const armLen = 2.5;
  const bucketLen = 1.2;

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
      dirtRef.current.scale.setScalar(0.3 + load * 0.7);
    }

    if (tipRef.current) {
      const boomEndX = Math.sin(s.boom) * boomLen;
      const boomEndY = Math.cos(s.boom) * boomLen;
      const armEndX = boomEndX + Math.sin(s.boom + s.arm) * armLen;
      const armEndY = boomEndY + Math.cos(s.boom + s.arm) * armLen;
      const tipX = armEndX + Math.sin(s.boom + s.arm + s.bucket) * bucketLen;
      const tipY = armEndY + Math.cos(s.boom + s.arm + s.bucket) * bucketLen;
      tipRef.current.position.set(0.8 + tipX, 1.0 + tipY, 0);
    }
  });

  return (
    <group ref={groupRef}>
      {/* 모델 전방(+X)을 주행·시선 방향(+Z)과 일치 */}
      <group rotation={[0, -Math.PI / 2, 0]}>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[2.2, 1.2, 1.8]} />
        <meshStandardMaterial color="#d92323" roughness={0.48} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[2.4, 0.4, 2]} />
        <meshStandardMaterial color="#20242b" roughness={0.65} metalness={0.12} />
      </mesh>

      <group ref={bladeRef} position={[-0.75, 0.25, 0]}>
        <mesh position={[-0.25, 0, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.32, 0.8, 2.65]} />
          <meshStandardMaterial color="#37424d" roughness={0.42} metalness={0.32} />
        </mesh>
        <mesh position={[-0.46, 0.08, 0]}>
          <boxGeometry args={[0.16, 0.5, 2.35]} />
          <meshStandardMaterial color="#d7dde2" roughness={0.36} metalness={0.45} />
        </mesh>
      </group>

      <group ref={boomSwingRef} position={[0.8, 1.0, 0]}>
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
            logoWidth={0.82}
            logoHeight={0.28}
            logoX={boomLen * 0.48}
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
              logoWidth={1.08}
              logoHeight={0.24}
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
              <LinkPin x={0} y={0} radius={0.16} width={0.5} />
              <HydraulicCylinder x={-0.18} y={0.27} length={0.9} angle={-0.38} />
              <group position={[bucketLen * 0.38, -0.18, 0]} rotation={[0, 0, -0.22]}>
                {[1, -1].map((side) => (
                  <mesh key={side} position={[0, 0, side * 0.5]}>
                    <shapeGeometry args={[bucketSideShape]} />
                    <meshStandardMaterial
                      color="#242b34"
                      metalness={0.5}
                      roughness={0.38}
                      side={THREE.DoubleSide}
                    />
                  </mesh>
                ))}
                {[
                  { x: -0.12, y: 0.13, r: -0.52, w: 0.68, c: "#505b66" },
                  { x: 0.08, y: -0.02, r: -0.32, w: 0.82, c: "#343d47" },
                  { x: 0.28, y: -0.18, r: -0.12, w: 0.9, c: "#20272f" },
                  { x: 0.48, y: -0.34, r: 0.08, w: 0.78, c: "#151a21" },
                ].map((plate) => (
                  <mesh key={`${plate.x}-${plate.y}`} position={[plate.x, plate.y, 0]} rotation={[0, 0, plate.r]}>
                    <boxGeometry args={[plate.w, 0.12, 0.94]} />
                    <meshStandardMaterial color={plate.c} metalness={0.48} roughness={0.42} />
                  </mesh>
                ))}
                <mesh position={[-0.26, 0.18, 0]} rotation={[0, 0, -0.35]}>
                  <boxGeometry args={[0.32, 0.18, 1.02]} />
                  <meshStandardMaterial color="#66717c" metalness={0.38} roughness={0.46} />
                </mesh>
                {[1, -1].map((side) => (
                  <mesh key={side} position={[-0.22, 0.13, side * 0.535]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.11, 0.11, 0.06, 18]} />
                    <meshStandardMaterial color="#d5dbe1" metalness={0.62} roughness={0.24} />
                  </mesh>
                ))}
                <mesh position={[0.78, -0.43, 0]} rotation={[0, 0, -0.18]}>
                  <boxGeometry args={[0.2, 0.12, 1.1]} />
                  <meshStandardMaterial color="#cfd6dd" metalness={0.58} roughness={0.26} />
                </mesh>
                {[-0.44, -0.22, 0, 0.22, 0.44].map((z) => (
                  <mesh key={z} position={[0.78, -0.42, z]} rotation={[0, 0, Math.PI + 0.72]}>
                    <coneGeometry args={[0.105, 0.18, 4]} />
                    <meshStandardMaterial color="#cfd6dd" metalness={0.58} roughness={0.24} />
                  </mesh>
                ))}
              </group>
              <mesh
                ref={dirtRef}
                position={[bucketLen * 0.45, -0.05, 0]}
                rotation={[0, 0, -Math.PI / 2]}
                visible={false}
              >
                <boxGeometry args={[bucketLen * 0.55, 0.35, 0.55]} />
                <meshStandardMaterial color="#6d4c2a" roughness={1} />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      <mesh ref={tipRef}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#ff5722" emissive="#ff5722" emissiveIntensity={0.3} />
      </mesh>
      </group>
    </group>
  );
}

function FirstPersonCamera({
  simRef,
}: {
  simRef: React.MutableRefObject<ExcavatorSimState>;
}) {
  useFrame(({ camera }) => {
    const s = simRef.current;
    const facing = s.heading + s.swing;
    const sideX = Math.cos(facing);
    const sideZ = -Math.sin(facing);
    const camX = s.posX - Math.sin(facing) * 2.1 + sideX * 1.15;
    const camZ = s.posZ - Math.cos(facing) * 2.1 + sideZ * 1.15;
    camera.position.set(camX, 3.15, camZ);
    const lookX = s.posX + Math.sin(facing) * 5.6;
    const lookZ = s.posZ + Math.cos(facing) * 5.6;
    camera.lookAt(lookX, 1.15, lookZ);
  });
  return null;
}

function SimLoop({
  inputRef,
  simRef,
  velRef,
  terrainRef,
  scoreRef,
  modeRef,
  allowedRef,
  auxiliaryRef,
  tutorialDumpRef,
  digFeedbackRef,
  onProgress,
  onTutorialTick,
}: ExcavatorSceneProps) {
  const lastReportedProgressRef = useRef(-1);
  const dustRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const sim = simRef.current;
    const raw = inputRef.current;
    const allowed = allowedRef.current;
    const filtered = filterInput(raw, allowed);
    const fb = digFeedbackRef.current;

    const hydraulicSpeedScale = auxiliaryRef.current?.highSpeed ? 1 : 0.5;
    applyControls(sim, filtered, dt, velRef.current, hydraulicSpeedScale);
    onTutorialTick();

    const tip = getBucketTipWorld(sim);
    const groundH = sampleHeight(terrainRef.current, tip.x, tip.z);
    const depthBelow = groundH - tip.y;
    const inZone = isInDigZone(tip.x, tip.z);
    const inDump = isInDumpZone(tip.x, tip.z);
    const bucketInWorkRange = depthBelow > -3.2 && depthBelow < 2.2;
    const tipOnGround = depthBelow > -1.2 && depthBelow < 2.2;
    const curled = isBucketCurled(sim.boom, sim.bucket);
    const canLoad = curled && bucketInWorkRange;

    fb.inDigZone = inZone;
    fb.inDumpZone = inDump;
    fb.tipOnGround = tipOnGround;
    fb.bucketCurled = curled;
    fb.canLoad = canLoad;
    fb.groundDepth = depthBelow;
    fb.digging = false;

    const isGame = modeRef.current === "game";

    const isTutorial = modeRef.current === "tutorial";
    const digRate = isTutorial ? 5.5 : 3.5;
    const loadRate = isTutorial ? 2.2 : 1.2;

    if (inZone && bucketInWorkRange && sim.bucketLoad < 1) {
      const scrape = Math.max(0.15, depthBelow + 0.6);
      const dug = digAt(terrainRef.current, tip.x, tip.z, 2.6, scrape * dt * digRate);
      fb.digging = dug > 0.002;

      if (dug > 0 && canLoad) {
        sim.bucketLoad = Math.min(1, sim.bucketLoad + dug * loadRate);
      }

      if (dustRef.current && fb.digging) {
        dustRef.current.visible = true;
        dustRef.current.position.set(tip.x, groundH + 0.15, tip.z);
        const s = 0.8 + Math.random() * 0.5;
        dustRef.current.scale.setScalar(s);
      } else if (dustRef.current) {
        dustRef.current.visible = false;
      }
    } else if (dustRef.current) {
      dustRef.current.visible = false;
    }

    if (inDump && sim.bucketLoad > 0.05 && canDumpBucket(sim.bucket)) {
      const dumpAmount = sim.bucketLoad * 0.3 * dt * 5;
      sim.bucketLoad = Math.max(0, sim.bucketLoad - dumpAmount);
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
    }
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

function ZoneMarkers() {
  return (
    <>
      <mesh position={[DIG_ZONE.x, 0.15, DIG_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[DIG_ZONE.radius, 48]} />
        <meshBasicMaterial color="#ff8f00" transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[DIG_ZONE.x, 0.2, DIG_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[DIG_ZONE.radius - 0.4, DIG_ZONE.radius, 48]} />
        <meshBasicMaterial color="#ffb300" transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[DIG_ZONE.x, 0.26, DIG_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.5, 3.2, 36]} />
        <meshBasicMaterial color="#fff3c4" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
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

function AuxiliarySceneEffects({
  auxiliaryRef,
}: {
  auxiliaryRef: React.RefObject<AuxiliaryControlState>;
}) {
  const beaconRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const aux = auxiliaryRef.current;
    if (!aux) return;
    if (beaconRef.current) {
      beaconRef.current.visible = aux.highSpeed || aux.safetyLocked;
      beaconRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 8) * 0.12);
      const mat = beaconRef.current.material;
      if (mat instanceof THREE.MeshBasicMaterial) {
        mat.color.set(aux.safetyLocked ? "#ff1744" : "#29b6f6");
      }
    }
  });

  return (
    <>
      <mesh ref={beaconRef} position={[0, 5.2, -4]} visible={false}>
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshBasicMaterial color="#29b6f6" transparent opacity={0.75} />
      </mesh>
    </>
  );
}

function SceneContent(props: ExcavatorSceneProps) {
  return (
    <>
      <color attach="background" args={["#87b8e8"]} />
      <fog attach="fog" args={["#87b8e8", 55, 220]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow={false} />
      <TerrainMesh terrainRef={props.terrainRef} />
      <WorksiteSetDressing />
      <ZoneMarkers />
      <WaypointMarker tutorialStepRef={props.tutorialStepRef} />
      <AuxiliarySceneEffects auxiliaryRef={props.auxiliaryRef} />
      <ExcavatorArm simRef={props.simRef} auxiliaryRef={props.auxiliaryRef} />
      <FirstPersonCamera simRef={props.simRef} />
      <SimLoop {...props} />
    </>
  );
}

export function ExcavatorScene(props: ExcavatorSceneProps) {
  return (
    <Canvas
      gl={{ antialias: false, powerPreference: "high-performance" }}
      dpr={[1, 1.5]}
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
    bucket: -0.35,
    posX: -18,
    posZ: -22,
    heading: 0,
    bucketLoad: 0,
  };
}

export function createInitialTerrain(): TerrainData {
  return createTerrain(-48, -48);
}
