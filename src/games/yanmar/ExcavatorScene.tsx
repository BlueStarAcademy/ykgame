"use client";

/* eslint-disable react-hooks/refs */

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
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
    if (armRef.current) armRef.current.rotation.z = -s.arm;
    if (bucketRef.current) bucketRef.current.rotation.z = -s.bucket;
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
          <mesh position={[boomLen / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <capsuleGeometry args={[0.16, boomLen, 8, 16]} />
            <meshStandardMaterial color="#d92323" roughness={0.42} metalness={0.12} />
          </mesh>
          <mesh position={[boomLen / 2, 0.03, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <capsuleGeometry args={[0.07, boomLen * 0.86, 6, 12]} />
            <meshStandardMaterial color="#f9c74f" roughness={0.35} metalness={0.16} />
          </mesh>

          <group ref={armRef} position={[boomLen, 0, 0]}>
            <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.22, 0.22, 0.46, 20]} />
              <meshStandardMaterial color="#303741" roughness={0.36} metalness={0.34} />
            </mesh>
            <mesh position={[armLen / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <capsuleGeometry args={[0.13, armLen, 8, 16]} />
              <meshStandardMaterial color="#c61f1f" roughness={0.44} metalness={0.14} />
            </mesh>
            <mesh position={[armLen / 2, 0.03, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <capsuleGeometry args={[0.055, armLen * 0.78, 6, 12]} />
              <meshStandardMaterial color="#ffcf57" roughness={0.35} metalness={0.12} />
            </mesh>

            <group ref={bucketRef} position={[armLen, 0, 0]}>
              <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.17, 0.17, 0.42, 18]} />
                <meshStandardMaterial color="#38414a" roughness={0.36} metalness={0.38} />
              </mesh>
              <mesh position={[bucketLen / 2, -0.15, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <boxGeometry args={[bucketLen, 0.5, 0.8]} />
                <meshStandardMaterial color="#59616b" metalness={0.38} roughness={0.48} />
              </mesh>
              <mesh position={[bucketLen * 0.92, -0.33, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <boxGeometry args={[0.12, 0.16, 0.92]} />
                <meshStandardMaterial color="#e4e8eb" metalness={0.45} roughness={0.3} />
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
  const lightRef = useRef<THREE.SpotLight>(null);
  const beaconRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const aux = auxiliaryRef.current;
    if (!aux) return;
    if (lightRef.current) {
      lightRef.current.intensity = aux.workLight ? 2.8 : 0;
    }
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
      <spotLight
        ref={lightRef}
        position={[0, 12, -18]}
        angle={0.42}
        penumbra={0.55}
        distance={70}
        intensity={0}
        color="#fff4c0"
      />
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
