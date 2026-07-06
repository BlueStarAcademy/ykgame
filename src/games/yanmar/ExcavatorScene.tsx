"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExcavatorControlState, ControlMask } from "./controls";
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
  createDigFeedback,
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
    const c0 = new THREE.Color("#9a7b4f");
    const cDug = new THREE.Color("#5c3d1e");
    const cMound = new THREE.Color("#b8956a");

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
      <meshStandardMaterial vertexColors roughness={0.92} metalness={0.02} />
    </mesh>
  );
}

function ExcavatorArm({
  simRef,
}: {
  simRef: React.MutableRefObject<ExcavatorSimState>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const boomRef = useRef<THREE.Group>(null);
  const armRef = useRef<THREE.Group>(null);
  const bucketRef = useRef<THREE.Group>(null);
  const dirtRef = useRef<THREE.Mesh>(null);
  const tipRef = useRef<THREE.Mesh>(null);

  const boomLen = 3;
  const armLen = 2.5;
  const bucketLen = 1.2;

  useFrame(() => {
    const g = groupRef.current;
    const s = simRef.current;
    if (!g) return;
    g.position.set(s.posX, 0, s.posZ);
    g.rotation.y = s.heading + s.swing;
    if (boomRef.current) boomRef.current.rotation.z = s.boom;
    if (armRef.current) armRef.current.rotation.z = s.arm;
    if (bucketRef.current) bucketRef.current.rotation.z = s.bucket;
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
        <meshStandardMaterial color="#E53935" />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[2.4, 0.4, 2]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      <group ref={boomRef} position={[0.8, 1.0, 0]}>
        <mesh position={[boomLen / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <boxGeometry args={[boomLen, 0.25, 0.25]} />
          <meshStandardMaterial color="#FFD54F" />
        </mesh>

        <group ref={armRef} position={[boomLen, 0, 0]}>
          <mesh position={[armLen / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <boxGeometry args={[armLen, 0.2, 0.2]} />
            <meshStandardMaterial color="#FFD54F" />
          </mesh>

          <group ref={bucketRef} position={[armLen, 0, 0]}>
            <mesh position={[bucketLen / 2, -0.15, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <boxGeometry args={[bucketLen, 0.5, 0.8]} />
              <meshStandardMaterial color="#777" metalness={0.3} roughness={0.6} />
            </mesh>
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
    const camX = s.posX - Math.sin(s.heading + s.swing) * 0.5;
    const camZ = s.posZ - Math.cos(s.heading + s.swing) * 0.5;
    camera.position.set(camX, 2.2, camZ);
    const lookX = s.posX + Math.sin(s.heading + s.swing) * 5;
    const lookZ = s.posZ + Math.cos(s.heading + s.swing) * 5;
    camera.lookAt(lookX, 1.5, lookZ);
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

    applyControls(sim, filtered, dt, velRef.current);
    onTutorialTick();

    const tip = getBucketTipWorld(sim);
    const groundH = sampleHeight(terrainRef.current, tip.x, tip.z);
    const depthBelow = groundH - tip.y;
    const inZone = isInDigZone(tip.x, tip.z);
    const inDump = isInDumpZone(tip.x, tip.z);
    const tipOnGround = depthBelow > -0.55 && depthBelow < 1.8;
    const curled = isBucketCurled(sim.boom, sim.bucket);
    const canLoad = curled && tipOnGround;

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

    if (inZone && tipOnGround && sim.bucketLoad < 1) {
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
        <meshBasicMaterial color="#ff9800" transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[DIG_ZONE.x, 0.2, DIG_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[DIG_ZONE.radius - 0.4, DIG_ZONE.radius, 48]} />
        <meshBasicMaterial color="#ff9800" transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[DUMP_ZONE.x, 0.2, DUMP_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[DUMP_ZONE.radius - 0.3, DUMP_ZONE.radius, 32]} />
        <meshBasicMaterial color="#4caf50" transparent opacity={0.55} side={THREE.DoubleSide} />
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
      <ZoneMarkers />
      <WaypointMarker tutorialStepRef={props.tutorialStepRef} />
      <ExcavatorArm simRef={props.simRef} />
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
