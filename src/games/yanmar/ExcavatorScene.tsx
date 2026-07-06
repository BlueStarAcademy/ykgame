"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExcavatorControlState, ControlMask } from "./controls";
import {
  applyControls,
  canDumpBucket,
  canLoadBucket,
  filterInput,
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
  terrainRef: React.MutableRefObject<TerrainData>;
  scoreRef: React.MutableRefObject<DiggingScoreState>;
  modeRef: React.RefObject<GameMode>;
  allowedRef: React.RefObject<ControlMask>;
  tutorialStepRef: React.RefObject<TutorialStep | null>;
  tutorialDumpRef: React.MutableRefObject<number>;
  onProgress: (dumped: number, progress: number) => void;
  onTutorialTick: () => void;
}

function TerrainMesh({ terrainRef }: { terrainRef: React.MutableRefObject<TerrainData> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geomRef = useRef<THREE.PlaneGeometry | null>(null);

  const geometry = useMemo(() => {
    const t = terrainRef.current;
    const geo = new THREE.PlaneGeometry(
      t.gridSize * t.cellSize,
      t.gridSize * t.cellSize,
      t.gridSize - 1,
      t.gridSize - 1,
    );
    geo.rotateX(-Math.PI / 2);
    geomRef.current = geo;
    return geo;
  }, [terrainRef]);

  useFrame(() => {
    const geo = geomRef.current;
    const t = terrainRef.current;
    if (!geo) return;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let gz = 0; gz < t.gridSize; gz++) {
      for (let gx = 0; gx < t.gridSize; gx++) {
        const idx = gz * t.gridSize + gx;
        const vi = idx;
        pos.setY(vi, t.heights[idx]);
      }
    }
    pos.needsUpdate = true;
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
      <meshStandardMaterial color="#8B7355" roughness={0.9} />
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
              <meshStandardMaterial color="#888" />
            </mesh>
          </group>
        </group>
      </group>

      <mesh ref={tipRef}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#ff5722" emissive="#ff5722" emissiveIntensity={0.3} />
      </mesh>
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
  terrainRef,
  scoreRef,
  modeRef,
  allowedRef,
  tutorialDumpRef,
  onProgress,
  onTutorialTick,
}: ExcavatorSceneProps) {
  const lastReportedProgressRef = useRef(-1);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const sim = simRef.current;
    const raw = inputRef.current;
    const allowed = allowedRef.current;
    const filtered = filterInput(raw, allowed);

    applyControls(sim, filtered, dt);
    onTutorialTick();

    // Bucket tip world position (approximate)
    const boomLen = 3;
    const armLen = 2.5;
    const bucketLen = 1.2;
    const bx =
      sim.posX +
      Math.sin(sim.heading + sim.swing) * 0.8 +
      Math.cos(sim.heading + sim.swing) *
        (Math.sin(sim.boom) * boomLen +
          Math.sin(sim.boom + sim.arm) * armLen +
          Math.sin(sim.boom + sim.arm + sim.bucket) * bucketLen);
    const bz =
      sim.posZ +
      Math.cos(sim.heading + sim.swing) * 0.8 -
      Math.sin(sim.heading + sim.swing) *
        (Math.sin(sim.boom) * boomLen +
          Math.sin(sim.boom + sim.arm) * armLen +
          Math.sin(sim.boom + sim.arm + sim.bucket) * bucketLen);
    const by =
      1.0 +
      Math.cos(sim.boom) * boomLen +
      Math.cos(sim.boom + sim.arm) * armLen +
      Math.cos(sim.boom + sim.arm + sim.bucket) * bucketLen;

    const groundH = sampleHeight(terrainRef.current, bx, bz) + 0.05;
    const isGame = modeRef.current === "game";

    if (isInDigZone(bx, bz) && by < groundH && sim.bucketLoad < 1) {
      const dug = digAt(terrainRef.current, bx, bz, 1.2, 0.15 * dt * 10);
      if (dug > 0 && canLoadBucket(sim.boom, sim.bucket)) {
        sim.bucketLoad = Math.min(1, sim.bucketLoad + dug * 0.5);
      }
    }

    if (isInDumpZone(bx, bz) && sim.bucketLoad > 0.05 && canDumpBucket(sim.bucket)) {
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

  return null;
}

function WaypointMarker({
  tutorialStepRef,
}: {
  tutorialStepRef: React.RefObject<TutorialStep | null>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    const mesh = meshRef.current;
    const wp = tutorialStepRef.current?.waypoint;
    if (!mesh) return;
    if (wp) {
      mesh.visible = true;
      mesh.position.set(wp.x, 0.08, wp.z);
      mesh.rotation.z += delta * 2;
    } else {
      mesh.visible = false;
    }
  });
  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.8, 1.4, 32]} />
      <meshBasicMaterial color="#29b6f6" transparent opacity={0.75} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ZoneMarkers() {
  return (
    <>
      <mesh position={[DIG_ZONE.x, 0.05, DIG_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[DIG_ZONE.radius - 0.3, DIG_ZONE.radius, 32]} />
        <meshBasicMaterial color="#ff9800" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[DUMP_ZONE.x, 0.05, DUMP_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[DUMP_ZONE.radius - 0.3, DUMP_ZONE.radius, 32]} />
        <meshBasicMaterial color="#4caf50" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

function SceneContent(props: ExcavatorSceneProps) {
  return (
    <>
      <color attach="background" args={["#87b8e8"]} />
      <fog attach="fog" args={["#87b8e8", 40, 120]} />
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
    boom: 0.5,
    arm: -0.8,
    bucket: -0.3,
    posX: -8,
    posZ: 0,
    heading: 0,
    bucketLoad: 0,
  };
}

export function createInitialTerrain(): TerrainData {
  return createTerrain(-24, -10);
}
