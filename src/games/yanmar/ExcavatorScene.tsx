"use client";

/* eslint-disable react-hooks/refs */

import { useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
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
            <boxGeometry args={[length * 0.18 * rootReliefScale, height * 0.16 * rootReliefScale, 0.028]} />
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
      <mesh position={[coreX, 0, 0]}>
        <boxGeometry args={[coreLength, height * 0.62, sideDepth * 1.45]} />
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

// Use the visible bucket shell's lowest sampled point, not the old mathematical tip.
const MIN_BUCKET_GROUND_CLEARANCE = -0.82;
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
    const filtered = filterInput(raw, allowed);
    const fb = digFeedbackRef.current;

    const hydraulicSpeedScale = auxiliaryRef.current?.highSpeed ? 1 : 0.5;
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

    const boomSwing = auxiliaryRef.current?.boomSwing ?? 0;
    let { clearance } = constrainBucketGroundContact(
      sim,
      terrainRef.current,
      boomSwing,
    );
    if (clearance < MIN_BUCKET_GROUND_CLEARANCE - 0.02) {
      sim.boom = beforeGroundContact.boom;
      sim.arm = beforeGroundContact.arm;
      sim.bucket = beforeGroundContact.bucket;
      velRef.current.boom = 0;
      velRef.current.arm = 0;
      velRef.current.bucket = 0;
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
    const bucketInWorkRange = scraperDepthBelow > -1.1 && scraperDepthBelow < 2.25;
    const tipOnGround = scraperDepthBelow > -0.9 && scraperDepthBelow < 2.25;
    const curled = isBucketCurled(sim.boom, sim.bucket);
    const canLoad = curled && bucketInWorkRange;

    fb.inDigZone = inZone;
    fb.inDumpZone = inDump;
    fb.tipOnGround = tipOnGround;
    fb.bucketCurled = curled;
    fb.canLoad = canLoad;
    fb.groundDepth = scraperDepthBelow;
    fb.digging = false;

    const isGame = modeRef.current === "game";

    const isTutorial = modeRef.current === "tutorial";
    const digRate = isTutorial ? 6.5 : 4.5;
    const loadRate = isTutorial ? 3.5 : 2.4;

    if (inZone && bucketInWorkRange && sim.bucketLoad < 1) {
      const scrape = Math.max(0.24, scraperDepthBelow + 0.68);
      const digX = scraperInDigZone ? scraper.x : tipInDigZone ? bucketTip.x : scraper.x;
      const digZ = scraperInDigZone ? scraper.z : tipInDigZone ? bucketTip.z : scraper.z;
      const scrapeMotion =
        Math.abs(velRef.current.arm) * 0.8 +
        Math.abs(velRef.current.travel) * 0.22 +
        Math.abs(velRef.current.bucket) * 0.35;
      const activelyScraping = scrapeMotion > 0.06;
      const dug =
        canLoad && tipOnGround && activelyScraping
          ? digAt(terrainRef.current, digX, digZ, 3.2, scrape * dt * digRate)
          : 0;
      fb.digging = dug > 0.002 || (canLoad && tipOnGround && activelyScraping);

      if (canLoad && tipOnGround && activelyScraping) {
        const scrapeLoad = scrapeMotion * (isTutorial ? 0.1 : 0.075) * dt;
        const minimumLoad = (isTutorial ? 0.18 : 0.12) * dt;
        const maxLoadDelta = (isTutorial ? 0.32 : 0.24) * dt;
        const loadDelta = Math.min(
          Math.max(dug * loadRate * 0.28 + scrapeLoad, minimumLoad),
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

function ScorePopupLayer({ popups }: { popups: DumpScorePopup[] }) {
  return (
    <>
      {popups.map((popup) => (
        <Html
          key={popup.id}
          position={[popup.x, popup.y, popup.z]}
          center
          distanceFactor={18}
          zIndexRange={[80, 40]}
          style={{ pointerEvents: "none" }}
        >
          <div
            className={`yanmar-score-pop rounded-xl border px-2.5 py-1.5 text-center text-xs font-black shadow-lg ${
              popup.critical
                ? "border-yellow-200 bg-yellow-400 text-black"
                : "border-white/30 bg-black/75 text-white"
            }`}
          >
            <div>{popup.critical ? "CRITICAL " : "+"}{popup.score}</div>
            {popup.rewardText ? (
              <div className="mt-0.5 text-[10px] font-bold">{popup.rewardText}</div>
            ) : null}
          </div>
        </Html>
      ))}
    </>
  );
}

function SceneContent(props: ExcavatorSceneProps) {
  return (
    <>
      <color attach="background" args={["#9fd2f2"]} />
      <fog attach="fog" args={["#b8dcf1", 70, 240]} />
      <hemisphereLight args={["#dff5ff", "#d6ad73", 0.75]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[22, 34, -28]}
        intensity={1.75}
        color="#fff2c1"
        castShadow={false}
      />
      <pointLight position={[34, 31, -56]} intensity={0.45} color="#ffe28a" distance={95} />
      <SunnySky />
      <TerrainMesh terrainRef={props.terrainRef} />
      <WorksiteSetDressing />
      <ZoneMarkers terrainRef={props.terrainRef} />
      <WaypointMarker tutorialStepRef={props.tutorialStepRef} />
      <AuxiliarySceneEffects auxiliaryRef={props.auxiliaryRef} />
      <ScorePopupLayer popups={props.scorePopups} />
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
