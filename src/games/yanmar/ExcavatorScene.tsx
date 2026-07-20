"use client";

/* eslint-disable react-hooks/refs */

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Billboard, ContactShadows, RoundedBox, Text } from "@react-three/drei";
import * as THREE from "three";
import { YK_GEONGI_LOGO } from "@/lib/brand-assets";
import type { AuxiliaryControlState, ExcavatorControlState, ControlMask, HydraulicVelocity } from "./controls";
import { DEFAULT_BOOM_SWING } from "./controls";
import { ExcavatorBucket } from "./ExcavatorBucket";
import { ExcavatorBreaker } from "./ExcavatorBreaker";
import { ExcavatorGrapple } from "./ExcavatorGrapple";
import {
  PremiumDozerBlade,
  PremiumExcavatorBody,
  SWING_HOUSE_LIFT_Y,
  SWING_PIVOT_X,
} from "./ExcavatorModel";
import { PremiumDumpTruckModel } from "./DumpTruckModel";
import {
  configureYkGeongiLogoTexture,
  createYkGeongiBoomDecalTexture,
  getDozerBladeReach,
  YANMAR_MACHINE_RIG,
} from "./machineVisualTheme";
import { poseWorkEquipmentCylinders } from "./workEquipment/hydraulicPose";
import {
  getBucketCylMeetLocal,
  WE,
} from "./workEquipment/workEquipmentStructure";
import {
  BoomArmClevis,
  BoomArmScrewPin,
  BoomHydraulicMounts,
  HydraulicCylinder,
  HydraulicMountBracket,
  ReferenceArm,
  ReferenceBoom,
  WorkLinkPin,
} from "./workEquipment/ykWorkGear";
import { getChassisVisualProfile } from "./chassisVisualConfig";
import { yanmarAudio } from "./yanmarAudio";
import {
  createTerrain,
  digZoneLabel,
  getActiveDigZones,
  getCrashZoneRespawnEtaSec,
  getHaulTruckReturnEtaSec,
  getHillZoneRespawnEtaSec,
  isHaulTruckVisible,
  isInCrashZone,
  isInDumpZone,
  isInHillZone,
  dumpTruckBedDeckWorldY,
  sampleHeight,
  sampleCrashContactHeight,
  sampleBreakerContactHeight,
  getCrashTileAt,
  shouldShowHaulTruckReturnTimer,
  HAUL_TRUCK_CAPACITY,
  type TerrainData,
  DIG_ZONE,
  DUMP_ZONE,
  DUMP_TRUCK,
  DUMP_TRUCK_BED,
  DUMP_TRUCK_BODY_LOCAL_Y,
  DUMP_TRUCK_GROUP_Y,
} from "./terrain";
import type { DigFeedback } from "./bucket";
import {
  getBreakerGroundAngleDeg,
  getBreakerTipWorld,
  getDozerBladeContactWorld,
  getMaxDozerBladeFromGround,
  MIN_BREAKER_GROUND_ANGLE_DEG,
} from "./bucket";
import {
  BREAKER_TIP_PROBE_RADIUS,
  BREAKER_TOUCH_BAND,
} from "./simConstants";
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
import type { GameMode, TutorialStep, TutorialWaypoint } from "./tutorial";
import type { YanmarEquipmentStats } from "./equipment";
import {
  createRockTexture,
} from "./proceduralTextures";
import {
  configureSiteTexture,
  PREMIUM_SITE_TEXTURES,
} from "./siteTextures";
import {
  buildTerrainScatterRocks,
  createRockGeometry,
  type ScatterRock,
} from "./terrainScatter";
import { MapSiteDecor } from "./mapDecor";
import { RepairTent } from "./RepairTent";
import { REPAIR_TENT } from "./gearCatalog";
import { WorkshopSigns } from "./WorkshopSign";
import { MonumentPylon } from "./MonumentPylon";
import type { WorkshopId } from "./workshop/types";
import { CrashZoneDecor } from "./CrashZoneDecor";
import { HillZoneDecor } from "./HillZoneDecor";
import { hillBoulderVisualScale } from "./terrain";
import type {
  CameraLookOffset,
  CameraMode,
  DumpScorePopup,
  ExcavatorSimState,
  AutoPoseState,
} from "./types";
import {
  createSimLoopRuntime,
  tickExcavatorSim,
  type DumpSoilVisual,
  type BladeSprayVisual,
} from "./simLoop";
import { WorldPickupMeshes } from "./WorldPickupMeshes";
import type { WorldPickup, WorldPickupsState } from "./worldPickups";

export type { CameraMode, DumpScorePopup, ExcavatorSimState };

interface ExcavatorSceneProps {
  inputRef: React.RefObject<ExcavatorControlState>;
  simRef: React.MutableRefObject<ExcavatorSimState>;
  velRef: React.MutableRefObject<HydraulicVelocity>;
  terrainRef: React.MutableRefObject<TerrainData>;
  /** Bumps terrain mesh/decor rebuild without remounting the WebGL canvas. */
  terrainRevision?: number;
  scoreRef: React.MutableRefObject<DiggingScoreState>;
  modeRef: React.RefObject<GameMode>;
  equipmentStatsRef: React.RefObject<YanmarEquipmentStats>;
  allowedRef: React.RefObject<ControlMask>;
  auxiliaryRef: React.RefObject<AuxiliaryControlState>;
  autoPoseRef: React.RefObject<AutoPoseState>;
  tutorialStepRef: React.RefObject<TutorialStep | null>;
  tutorialWaypointRef?: React.RefObject<TutorialWaypoint | null>;
  tutorialDumpRef: React.MutableRefObject<number>;
  digFeedbackRef: React.MutableRefObject<DigFeedback>;
  dumpTruckStateRef: React.MutableRefObject<DumpTruckRuntimeState>;
  dumpTruckPoseRef: React.MutableRefObject<DumpTruckPose>;
  onProgress: (dumped: number, progress: number) => void;
  onDumpScore: (popup: Omit<DumpScorePopup, "id">) => void;
  onCrashTileDestroyed: (tileId: string) => void;
  onHillRockDelivered: (rockId: string) => void;
  onAttachmentWarning: (message: string) => void;
  onDumpTruckFull?: () => void;
  onHaulTruckFull?: () => void;
  onSimTick: () => void;
  cameraMode: CameraMode;
  lookOffsetRef: React.MutableRefObject<CameraLookOffset>;
  endedRef?: React.RefObject<boolean>;
  /** Active chassis model — drives cab style / body scale */
  activeChassisId?: string;
  /** Fired once after Suspense loaders resolve and the first frames paint. */
  onSceneReady?: () => void;
  worldPickupsRef?: React.MutableRefObject<WorldPickupsState | null>;
  worldPickupRevision?: number;
  onWorldPickup?: (pickup: WorldPickup) => void;
  workshopClaimableIds?: ReadonlySet<WorkshopId> | readonly WorkshopId[];
  monumentPhase?: import("./monument/types").MonumentPhase;
  monumentStarsStored?: number;
  monumentStorageCap?: number;
}

function TerrainMesh({
  terrainRef,
  terrainRevision = 0,
}: {
  terrainRef: React.MutableRefObject<TerrainData>;
  terrainRevision?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geomRef = useRef<THREE.PlaneGeometry | null>(null);
  const colorsRef = useRef<Float32Array | null>(null);
  const normalFrameRef = useRef(0);
  const groundNormalScale = useMemo(
    () => new THREE.Vector2(0.42, 0.42),
    [],
  );
  const loadedGroundTextures = useLoader(
    THREE.TextureLoader,
    [
      PREMIUM_SITE_TEXTURES.groundAlbedo,
      PREMIUM_SITE_TEXTURES.groundNormal,
      PREMIUM_SITE_TEXTURES.groundRoughness,
    ],
  );
  const [dirtTexture, groundNormal, groundRoughness] = useMemo(
    () => loadedGroundTextures.map((texture) => texture.clone()),
    [loadedGroundTextures],
  );

  useLayoutEffect(() => {
    configureSiteTexture(dirtTexture, 18, 18, true);
    configureSiteTexture(groundNormal, 18);
    configureSiteTexture(groundRoughness, 18);
    return () => {
      dirtTexture.dispose();
      groundNormal.dispose();
      groundRoughness.dispose();
    };
  }, [dirtTexture, groundNormal, groundRoughness]);

  const geometry = useMemo(() => {
    const t = terrainRef.current;
    const geo = new THREE.PlaneGeometry(
      t.gridSizeX * t.cellSize,
      t.gridSizeZ * t.cellSize,
      t.gridSizeX - 1,
      t.gridSizeZ - 1,
    );
    geo.rotateX(-Math.PI / 2);
    const count = geo.attributes.position.count;
    colorsRef.current = new Float32Array(count * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(colorsRef.current, 3));
    geomRef.current = geo;
    return geo;
    // terrainRevision rebuilds the plane when map tier / grid size changes.
  }, [terrainRef, terrainRevision]);

  useLayoutEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame(() => {
    const geo = geomRef.current;
    const t = terrainRef.current;
    const colors = colorsRef.current;
    if (!geo || !colors) return;
    const expectedCount = t.gridSizeX * t.gridSizeZ;
    if (geo.attributes.position.count !== expectedCount) return;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const cGround = new THREE.Color("#d4b07a");
    const cDug = new THREE.Color("#7a5230");
    const cDeepDug = new THREE.Color("#5c3d22");
    const cMound = new THREE.Color("#e8c88a");
    const cMoundPeak = new THREE.Color("#f2d9a6");
    const cPacked = new THREE.Color("#b89262");
    const cGravel = new THREE.Color("#c4b29a");

    const heightAt = (gx: number, gz: number) => {
      const cx = Math.max(0, Math.min(t.gridSizeX - 1, gx));
      const cz = Math.max(0, Math.min(t.gridSizeZ - 1, gz));
      return t.heights[cz * t.gridSizeX + cx];
    };

    for (let gz = 0; gz < t.gridSizeZ; gz++) {
      for (let gx = 0; gx < t.gridSizeX; gx++) {
        const idx = gz * t.gridSizeX + gx;
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
    normalFrameRef.current = (normalFrameRef.current + 1) % 4;
    if (normalFrameRef.current === 0) geo.computeVertexNormals();
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[
        terrainRef.current.originX +
          (terrainRef.current.gridSizeX * terrainRef.current.cellSize) / 2,
        0,
        terrainRef.current.originZ +
          (terrainRef.current.gridSizeZ * terrainRef.current.cellSize) / 2,
      ]}
      receiveShadow
    >
      <meshStandardMaterial
        map={dirtTexture}
        normalMap={groundNormal}
        normalScale={groundNormalScale}
        roughnessMap={groundRoughness}
        vertexColors
        roughness={0.9}
        metalness={0.015}
      />
    </mesh>
  );
}

function TerrainRockScatter({ terrainRef }: { terrainRef: React.MutableRefObject<TerrainData> }) {
  const instancesRef = useRef<THREE.InstancedMesh>(null);
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

  useLayoutEffect(() => {
    const mesh = instancesRef.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const euler = new THREE.Euler();
    rocks.forEach((rock, index) => {
      position.set(rock.x, rock.y, rock.z);
      euler.set(rock.rotX, rock.rotY, 0);
      quaternion.setFromEuler(euler);
      scale.set(rock.scale * 1.1, rock.scale * 0.7, rock.scale);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.count = rocks.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [rocks]);

  return (
    <instancedMesh
      ref={instancesRef}
      args={[rockGeometry, undefined, Math.max(1, rocks.length)]}
      receiveShadow
    >
      <meshStandardMaterial
        map={rockTexture}
        color="#b0a89c"
        roughness={0.92}
        metalness={0.04}
      />
    </instancedMesh>
  );
}

type DumpSoilVisualState = DumpSoilVisual;
type BladeSprayVisualState = BladeSprayVisual;

function BladeSoilSpray({
  visualRef,
}: {
  visualRef: React.MutableRefObject<BladeSprayVisualState>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const particleStates = useRef(
    Array.from({ length: 28 }, () => ({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 1,
      size: 0.1,
    })),
  );

  useFrame((_, dt) => {
    const group = groupRef.current;
    if (!group) return;

    const visual = visualRef.current;
    visual.intensity = Math.max(0, visual.intensity - dt * 2.4);
    const spraying = visual.active && visual.intensity > 0.04;
    if (!spraying) {
      visual.active = false;
    }

    if (spraying) {
      const forwardX = Math.sin(visual.heading);
      const forwardZ = Math.cos(visual.heading);
      const sideX = Math.cos(visual.heading);
      const sideZ = -Math.sin(visual.heading);
      const spawnBudget = Math.ceil(visual.intensity * 7);
      for (let i = 0; i < spawnBudget; i += 1) {
        const slot = particleStates.current.find((particle) => !particle.active);
        if (!slot) break;
        const side = (Math.random() - 0.5) * 1.7;
        const forward = 0.15 + Math.random() * 0.35;
        slot.active = true;
        slot.x = visual.x + forwardX * forward + sideX * side;
        slot.z = visual.z + forwardZ * forward + sideZ * side;
        slot.y = visual.y + Math.random() * 0.12;
        const speed = 1.4 + Math.random() * 2.6 * visual.intensity;
        slot.vx = forwardX * speed + sideX * (Math.random() - 0.5) * 1.1;
        slot.vz = forwardZ * speed + sideZ * (Math.random() - 0.5) * 1.1;
        slot.vy = 1.1 + Math.random() * 2.4;
        slot.maxLife = 0.35 + Math.random() * 0.45;
        slot.life = slot.maxLife;
        slot.size = 0.07 + Math.random() * 0.1;
      }
    }

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
      particle.vy -= 14 * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.z += particle.vz * dt;
      if (particle.y < visual.y - 0.05) {
        particle.active = false;
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      anyVisible = true;
      const lifeT = particle.life / particle.maxLife;
      mesh.position.set(particle.x, particle.y, particle.z);
      mesh.scale.setScalar(particle.size * (0.65 + lifeT * 0.7));
      mesh.rotation.x += dt * 5.5;
      mesh.rotation.z += dt * 4.2;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.25 + lifeT * 0.55;
    });
    group.visible = anyVisible;
  });

  return (
    <group ref={groupRef} visible={false}>
      {Array.from({ length: 28 }, (_, index) => (
        <mesh key={index} visible={false}>
          <sphereGeometry args={[1, 5, 5]} />
          <meshStandardMaterial
            color={index % 2 ? "#8a5a32" : "#b07a48"}
            roughness={0.95}
            metalness={0.02}
            transparent
            opacity={0.7}
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


const YANMAR_LOGO_ASPECT = 512 / 62;
const YK_LABEL_ASPECT = YK_GEONGI_LOGO.aspect;
const YANMAR_LOGO_WIDTH = 1.24;
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
const EXCAVATOR_FIXED_VISUAL_Y = YANMAR_MACHINE_RIG.excavatorVisualY;

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
    if (pedalRef.current) pedalRef.current.rotation.x = (aux?.boomSwing ?? DEFAULT_BOOM_SWING) * 0.16;
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
    const trackSpeed =
      side < 0 ? velRef.current.trackLeft : velRef.current.trackRight;
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
  const ykLogo = useLoader(THREE.TextureLoader, YK_GEONGI_LOGO.white);
  const [yanmarLogo, setYanmarLogo] = useState<THREE.Texture | null>(null);

  useLayoutEffect(() => {
    configureYkGeongiLogoTexture(ykLogo);
  }, [ykLogo]);

  useLayoutEffect(() => {
    const yanmarTexture = createYanmarRearLabelTexture();
    if (yanmarTexture) setYanmarLogo(yanmarTexture);
    return () => {
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

const FREE_LOOK_TRAVEL_THRESHOLD = 0.08;
const FREE_LOOK_RESET_RATE = 10;
const FREE_LOOK_MIN_GROUND_CLEARANCE = 0.9;
/** 자유시점으로 차체를 보여줄 최소 시선 오프셋(rad) */
const FREE_LOOK_BODY_VISIBLE_EPS = 0.02;
const FREE_LOOK_FOLLOW_RATE = 26;
const FREE_LOOK_INERTIA_DAMP = 3.2;
const FREE_LOOK_PITCH_MIN = -0.55;
const FREE_LOOK_PITCH_MAX = 0.42;

function ExcavatorArm({
  simRef,
  velRef,
  terrainRef,
  auxiliaryRef,
  inputRef,
  cameraMode,
  lookOffsetRef,
  activeChassisId,
}: {
  simRef: React.MutableRefObject<ExcavatorSimState>;
  velRef: React.MutableRefObject<HydraulicVelocity>;
  terrainRef: React.MutableRefObject<TerrainData>;
  auxiliaryRef: React.RefObject<AuxiliaryControlState>;
  inputRef: React.RefObject<ExcavatorControlState>;
  cameraMode: CameraMode;
  lookOffsetRef: React.MutableRefObject<CameraLookOffset>;
  activeChassisId?: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const machineBodyRef = useRef<THREE.Group>(null);
  const upperBodyYawRef = useRef<THREE.Group>(null);
  const workEquipmentYawRef = useRef<THREE.Group>(null);
  const boomSwingRef = useRef<THREE.Group>(null);
  const boomRef = useRef<THREE.Group>(null);
  const armRef = useRef<THREE.Group>(null);
  const boomCylinderRef = useRef<THREE.Group>(null);
  const armCylinderRef = useRef<THREE.Group>(null);
  const bucketCylinderRef = useRef<THREE.Group>(null);
  const bucketCylinderGearRef = useRef<THREE.Group>(null);
  const bucketRef = useRef<THREE.Group>(null);
  const bucketVisualRef = useRef<THREE.Group>(null);
  const breakerVisualRef = useRef<THREE.Group>(null);
  const breakerChiselRef = useRef<THREE.Group>(null);
  const grappleVisualRef = useRef<THREE.Group>(null);
  const carriedRockRef = useRef<THREE.Mesh>(null);
  const dirtRef = useRef<THREE.Mesh>(null);
  const tipRef = useRef<THREE.Mesh>(null);
  const bladeRef = useRef<THREE.Group>(null);
  const yanmarLogo = useLoader(THREE.TextureLoader, "/images/yanmar/yanmar-logo-white.png");
  const ykBoomLogo = useLoader(THREE.TextureLoader, YK_GEONGI_LOGO.white);

  useLayoutEffect(() => {
    configureDecalTexture(yanmarLogo);
  }, [yanmarLogo]);

  useLayoutEffect(() => {
    configureYkGeongiLogoTexture(ykBoomLogo);
  }, [ykBoomLogo]);

  const ykBoomDecal = useMemo(
    () => createYkGeongiBoomDecalTexture(ykBoomLogo.image),
    [ykBoomLogo],
  );

  useLayoutEffect(() => {
    return () => {
      ykBoomDecal?.texture.dispose();
    };
  }, [ykBoomDecal]);

  const boomLogoTexture = ykBoomDecal?.texture ?? ykBoomLogo;
  const boomLogoAspect = ykBoomDecal?.aspect ?? YK_LABEL_ASPECT;
  const boomLogoWidth = 0.82;

  const boomLen = YANMAR_MACHINE_RIG.boomLength;
  const armLen = YANMAR_MACHINE_RIG.armLength;
  const bucketLen = YANMAR_MACHINE_RIG.bucketLength;
  const chassisVisual = getChassisVisualProfile(activeChassisId);
  const boomThickness = chassisVisual.boomThickness;
  const dozerBladeReach = getDozerBladeReach(
    chassisVisual.scale,
    chassisVisual.trackWidth,
  );
  const bladeGroupX =
    dozerBladeReach - YANMAR_MACHINE_RIG.dozerBladeMeshLocalX;

  useFrame((_, delta) => {
    const g = groupRef.current;
    const s = simRef.current;
    if (!g) return;

    const look = lookOffsetRef.current;
    const freeLooking =
      Math.abs(look.yaw) > FREE_LOOK_BODY_VISIBLE_EPS ||
      Math.abs(look.pitch) > FREE_LOOK_BODY_VISIBLE_EPS ||
      Math.abs(look.distance - 1) > FREE_LOOK_BODY_VISIBLE_EPS ||
      Math.abs(look.targetYaw) > FREE_LOOK_BODY_VISIBLE_EPS ||
      Math.abs(look.targetPitch) > FREE_LOOK_BODY_VISIBLE_EPS ||
      Math.abs(look.targetDistance - 1) > FREE_LOOK_BODY_VISIBLE_EPS ||
      Math.abs(look.velYaw) > 0.02 ||
      Math.abs(look.velPitch) > 0.02;
    // 카메라3(운전석)는 기본으로 차체를 숨기지만, 자유시점으로 둘러볼 때는 표시한다.
    const showBody = cameraMode !== 3 || freeLooking;
    // 월드 붐 피벗 = posY + boomPivotY 와 맞춘다 (bucket.ts 접촉점과 동일).
    // 3인칭은 차체 visualY 를 그룹에 올리고, 운전석은 그룹을 posY 에 두므로 armRootY 만 보정.
    const armRootY = showBody
      ? YANMAR_MACHINE_RIG.boomPivotY - EXCAVATOR_FIXED_VISUAL_Y
      : YANMAR_MACHINE_RIG.boomPivotY;
    const terrainY = showBody
      ? EXCAVATOR_FIXED_VISUAL_Y + s.posY
      : s.posY;
    g.position.set(s.posX, terrainY, s.posZ);
    const baseFacing = s.heading;
    const probe = 1.35;
    const forwardX = Math.sin(baseFacing);
    const forwardZ = Math.cos(baseFacing);
    const rightX = Math.cos(baseFacing);
    const rightZ = -Math.sin(baseFacing);
    const terrain = terrainRef.current;
    const frontHeight = sampleHeight(
      terrain,
      s.posX + forwardX * probe,
      s.posZ + forwardZ * probe,
    );
    const backHeight = sampleHeight(
      terrain,
      s.posX - forwardX * probe,
      s.posZ - forwardZ * probe,
    );
    const rightHeight = sampleHeight(
      terrain,
      s.posX + rightX * probe,
      s.posZ + rightZ * probe,
    );
    const leftHeight = sampleHeight(
      terrain,
      s.posX - rightX * probe,
      s.posZ - rightZ * probe,
    );
    const targetPitch = Math.max(
      -0.3,
      Math.min(0.3, -Math.atan2(frontHeight - backHeight, probe * 2)),
    );
    const targetRoll = Math.max(
      -0.24,
      Math.min(0.24, Math.atan2(rightHeight - leftHeight, probe * 2)),
    );
    const terrainFollow = 1 - Math.exp(-delta * 9);
    g.rotation.order = "YXZ";
    g.rotation.x += (targetPitch - g.rotation.x) * terrainFollow;
    g.rotation.y = baseFacing;
    g.rotation.z += (targetRoll - g.rotation.z) * terrainFollow;
    if (upperBodyYawRef.current) upperBodyYawRef.current.rotation.y = s.swing;
    if (workEquipmentYawRef.current) workEquipmentYawRef.current.rotation.y = s.swing;
    const aux = auxiliaryRef.current;
    const blade = Math.max(0, Math.min(1, aux?.blade ?? 0));
    const bladeProbe = getDozerBladeContactWorld(s, 0, dozerBladeReach);
    const bladeAsphaltTile = getCrashTileAt(
      terrainRef.current,
      bladeProbe.x,
      bladeProbe.z,
    );
    const bladeOnAsphalt = !!bladeAsphaltTile?.active;
    let visualBlade = blade;
    if (bladeOnAsphalt) {
      const asphaltSurface = sampleCrashContactHeight(
        terrainRef.current,
        bladeProbe.x,
        bladeProbe.z,
      );
      visualBlade = Math.min(
        blade,
        getMaxDozerBladeFromGround(s, asphaltSurface, 0.02, dozerBladeReach),
      );
    }
    // 아스팔트는 posY 리프트로 차체를 들므로 추가 시각 리프트는 쓰지 않는다.
    const bladeSupportProgress = bladeOnAsphalt
      ? 0
      : THREE.MathUtils.smoothstep(blade, 0.8, 1);
    const targetChassisLift = bladeSupportProgress * 0.035;
    const targetChassisTilt = bladeSupportProgress * 0.035;
    const bladeSupportFollow = 1 - Math.exp(-delta * 8);
    if (machineBodyRef.current) {
      machineBodyRef.current.visible = showBody;
      machineBodyRef.current.position.y +=
        (targetChassisLift - machineBodyRef.current.position.y) * bladeSupportFollow;
      machineBodyRef.current.rotation.z +=
        (targetChassisTilt - machineBodyRef.current.rotation.z) * bladeSupportFollow;
    }
    if (boomSwingRef.current) {
      boomSwingRef.current.rotation.y = (aux?.boomSwing ?? DEFAULT_BOOM_SWING) * 0.38;
      boomSwingRef.current.position.y +=
        (armRootY + targetChassisLift - boomSwingRef.current.position.y) *
        bladeSupportFollow;
      boomSwingRef.current.rotation.z +=
        (targetChassisTilt - boomSwingRef.current.rotation.z) * bladeSupportFollow;
    }
    // Match the visual pivots to bucket.ts: segment direction is (sin(theta), cos(theta)).
    const boomRotation = Math.PI / 2 - s.boom;
    const armRotation = s.arm * YANMAR_MACHINE_RIG.armRotationScale;
    if (boomRef.current) boomRef.current.rotation.z = boomRotation;
    if (armRef.current) armRef.current.rotation.z = armRotation;

    const bucketRotation = s.bucket * YANMAR_MACHINE_RIG.bucketRotationScale;
    if (bucketRef.current) bucketRef.current.rotation.z = bucketRotation;

    // Boom/arm work gear (cylinders + joint cover) stays for every attachment,
    // including breaker — only the tip tool mesh swaps.
    if (bucketCylinderGearRef.current) {
      bucketCylinderGearRef.current.visible = true;
    }
    poseWorkEquipmentCylinders({
      boomJoint: s.boom,
      armJoint: armRotation,
      bucketJoint: bucketRotation,
      boomCylinder: boomCylinderRef.current,
      armCylinder: armCylinderRef.current,
      bucketCylinder: bucketCylinderRef.current,
      showBucketCylinder: true,
      boomLen,
      armLen,
    });
    if (bucketVisualRef.current) {
      bucketVisualRef.current.visible =
        s.attachmentType === "bucket" || s.attachmentType === "grapple";
    }
    if (breakerVisualRef.current) {
      const isBreaker = s.attachmentType === "breaker";
      breakerVisualRef.current.visible = isBreaker;
      breakerVisualRef.current.position.set(0, 0, 0);
      if (isBreaker) {
        const boomSwing = aux?.boomSwing ?? DEFAULT_BOOM_SWING;
        const tip = getBreakerTipWorld(s, boomSwing);
        const { height: groundY, tile } = sampleBreakerContactHeight(
          terrainRef.current,
          tip.x,
          tip.z,
          BREAKER_TIP_PROBE_RADIUS,
        );
        const onAsphalt =
          tip.y - groundY <= BREAKER_TOUCH_BAND &&
          getBreakerGroundAngleDeg(s, boomSwing) >= MIN_BREAKER_GROUND_ANGLE_DEG &&
          !!tile?.active;
        const hammering = (aux?.attachmentPedal ?? 0) !== 0 && onAsphalt;
        yanmarAudio.setBreakerHammering(hammering);
        const t = performance.now();
        if (breakerChiselRef.current) {
          breakerChiselRef.current.position.x = hammering
            ? Math.sin(t * 0.17) * 0.026 + Math.sin(t * 0.33) * 0.008
            : 0;
        }
      } else {
        yanmarAudio.setBreakerHammering(false);
        if (breakerChiselRef.current) {
          breakerChiselRef.current.position.x = 0;
        }
      }
    }
    if (grappleVisualRef.current) {
      grappleVisualRef.current.visible = s.attachmentType === "grapple";
      grappleVisualRef.current.userData.openAmount = aux?.grappleOpen ?? 1;
    }
    if (carriedRockRef.current) {
      const carrying =
        s.attachmentType === "grapple" && s.carriedBoulderId != null;
      carriedRockRef.current.visible = carrying;
      if (carrying && s.carriedBoulderId) {
        const rock = terrainRef.current.hillZone?.boulders.find(
          (item) => item.id === s.carriedBoulderId,
        );
        const scale = rock ? hillBoulderVisualScale(rock.size) : 0.9;
        carriedRockRef.current.scale.setScalar(0.72 + scale * 0.55);
      }
    }
    if (bladeRef.current) {
      // 흙밭: 레버 그대로(절반 침투 허용). 아스팔트: 표면에서 클램프.
      // 카메라3는 차체 그룹을 낮추므로, 도저만 보일 때도 3인칭과 같은 높이로 보정.
      const bladeHeightOffset = showBody ? 0 : EXCAVATOR_FIXED_VISUAL_Y;
      bladeRef.current.position.x = bladeGroupX;
      bladeRef.current.position.y =
        YANMAR_MACHINE_RIG.dozerBladeGroupBaseY +
        bladeHeightOffset -
        visualBlade * YANMAR_MACHINE_RIG.dozerBladeDrop;
    }
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
        -0.32 - fill * 0.18,
        -0.4 + fill * 0.12,
        0,
      );
    }

    if (tipRef.current) {
      const boomEndX = Math.sin(s.boom) * boomLen;
      const boomEndY = Math.cos(s.boom) * boomLen;
      const visualArmAngle = s.boom - s.arm * YANMAR_MACHINE_RIG.armRotationScale;
      const visualBucketAngle =
        visualArmAngle - s.bucket * YANMAR_MACHINE_RIG.bucketRotationScale;
      const armEndX = boomEndX + Math.sin(visualArmAngle) * armLen;
      const armEndY = boomEndY + Math.cos(visualArmAngle) * armLen;
      const tipX = armEndX - Math.sin(visualBucketAngle) * bucketLen;
      const tipY = armEndY - Math.cos(visualBucketAngle) * bucketLen;
      tipRef.current.position.set(
        YANMAR_MACHINE_RIG.boomOffset + tipX,
        armRootY + SWING_HOUSE_LIFT_Y + tipY,
        0,
      );
    }
  });

  return (
    <group ref={groupRef}>
      {/* 모델 전방(+X)을 주행·시선 방향(+Z)과 일치 */}
      <group rotation={[0, -Math.PI / 2, 0]}>
        <group ref={machineBodyRef} visible={cameraMode !== 3}>
          <PremiumExcavatorBody
            velRef={velRef}
            ykLogo={ykBoomLogo}
            upperBodyRef={upperBodyYawRef}
            chassisId={activeChassisId}
          />
        </group>
        <group
          ref={bladeRef}
          position={[bladeGroupX, YANMAR_MACHINE_RIG.dozerBladeGroupBaseY, 0]}
        >
          <PremiumDozerBlade
            trackWidth={chassisVisual.trackWidth}
            scale={chassisVisual.scale}
          />
        </group>

        <group
          ref={workEquipmentYawRef}
          position={[SWING_PIVOT_X, SWING_HOUSE_LIFT_Y, 0]}
        >
        <group
          ref={boomSwingRef}
          position={[
            YANMAR_MACHINE_RIG.boomOffset - SWING_PIVOT_X,
            YANMAR_MACHINE_RIG.boomPivotY - EXCAVATOR_FIXED_VISUAL_Y,
            0,
          ]}
        >
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.36, 20]} />
          <meshStandardMaterial color="#2b3139" roughness={0.38} metalness={0.32} />
        </mesh>
        <group ref={boomRef}>
          <ReferenceBoom
            length={boomLen}
            logo={boomLogoTexture}
            logoWidth={boomLogoWidth}
            logoHeight={logoHeightForWidth(boomLogoWidth, boomLogoAspect)}
          />
          <WorkLinkPin x={0} y={0} radius={0.11} width={0.34} />
          <BoomHydraulicMounts boomLen={boomLen} />
          {/* Boom-lift: rod tip ends inside 45° kink cover pocket */}
          <HydraulicCylinder
            barrelLength={0.72}
            initialDistance={1.05}
            radius={0.045}
            detail="clean"
            controlRef={boomCylinderRef}
          />
          {/* Boom–arm pivot — clean pin faces (reference joint hero) */}
          <BoomArmScrewPin x={boomLen} y={0} radius={0.095} width={0.34} />
          {/* Boom 등 실린더: 꺾임 후드 → 붐 끝 (채널 안, 배럴 노출) */}
          <HydraulicCylinder
            barrelLength={1.2}
            initialDistance={1.77}
            radius={0.062}
            controlRef={armCylinderRef}
          />

          <group ref={armRef} position={[boomLen, 0, 0]}>
            <ReferenceArm
              length={armLen}
              logo={yanmarLogo}
              logoWidth={YANMAR_LOGO_WIDTH}
              logoHeight={logoHeightForWidth(YANMAR_LOGO_WIDTH, YANMAR_LOGO_ASPECT)}
              logoX={armLen * 0.52}
            />
            {/* Jumper pipe (boom-cyl ↔ arm-cyl) + bolted cover */}
            <BoomArmClevis />
            <group ref={bucketCylinderGearRef}>
              {/* Arm cylinder after jumper → H-link */}
              <HydraulicMountBracket
                x={getBucketCylMeetLocal(boomLen).x}
                y={getBucketCylMeetLocal(boomLen).y}
                width={0.18}
              />
              <HydraulicCylinder
                barrelLength={1.4}
                initialDistance={2.2}
                detail="full"
                radius={0.056}
                controlRef={bucketCylinderRef}
              />
            </group>

            <group ref={bucketRef} position={[armLen, 0, 0]}>
              <group ref={bucketVisualRef}>
                <ExcavatorBucket dirtRef={dirtRef} />
              </group>
              <group ref={breakerVisualRef}>
                <ExcavatorBreaker chiselRef={breakerChiselRef} />
              </group>
              <group ref={grappleVisualRef}>
                <ExcavatorGrapple
                  openAmountRef={grappleVisualRef}
                />
                <mesh
                  ref={carriedRockRef}
                  position={[
                    YANMAR_MACHINE_RIG.grappleClampLocalX,
                    YANMAR_MACHINE_RIG.grappleClampLocalY,
                    0,
                  ]}
                  castShadow
                >
                  <dodecahedronGeometry args={[0.58, 1]} />
                  <meshStandardMaterial color="#5b6470" roughness={0.92} />
                </mesh>
              </group>
            </group>
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

function ExcavatorGroundContact({
  simRef,
  terrainRef,
}: {
  simRef: React.MutableRefObject<ExcavatorSimState>;
  terrainRef: React.MutableRefObject<TerrainData>;
}) {
  const shadowRef = useRef<THREE.Mesh>(null);
  const alphaMap = useMemo(() => {
    if (typeof document === "undefined") {
      const fallback = new THREE.DataTexture(
        new Uint8Array([255, 255, 255, 255]),
        1,
        1,
      );
      fallback.needsUpdate = true;
      return fallback;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (context) {
      const gradient = context.createRadialGradient(64, 64, 16, 64, 64, 64);
      gradient.addColorStop(0, "#ffffff");
      gradient.addColorStop(0.56, "#b8b8b8");
      gradient.addColorStop(1, "#000000");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 128);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);
  useLayoutEffect(() => () => alphaMap.dispose(), [alphaMap]);
  useFrame(() => {
    const mesh = shadowRef.current;
    if (!mesh) return;
    const sim = simRef.current;
    mesh.position.set(
      sim.posX,
      sampleHeight(terrainRef.current, sim.posX, sim.posZ) + 0.035,
      sim.posZ,
    );
    mesh.rotation.set(-Math.PI / 2, 0, sim.heading);
  });
  return (
    <mesh ref={shadowRef} scale={[1.4, 0.78, 1]} renderOrder={3}>
      <circleGeometry args={[1.65, 40]} />
      <meshBasicMaterial
        color="#17120d"
        alphaMap={alphaMap}
        transparent
        opacity={0.28}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  );
}

function GameCamera({
  simRef,
  mode,
  lookOffsetRef,
  inputRef,
  terrainRef,
}: {
  simRef: React.MutableRefObject<ExcavatorSimState>;
  mode: CameraMode;
  lookOffsetRef: React.MutableRefObject<CameraLookOffset>;
  inputRef: React.RefObject<ExcavatorControlState>;
  terrainRef: React.MutableRefObject<TerrainData>;
}) {
  const orbitScratch = useRef({
    offset: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
  });

  useFrame(({ camera }, delta) => {
    const s = simRef.current;
    if (
      !Number.isFinite(s.posX) ||
      !Number.isFinite(s.posZ) ||
      !Number.isFinite(s.heading) ||
      !Number.isFinite(s.swing)
    ) {
      return;
    }
    const baseY = Number.isFinite(s.posY) ? s.posY : 0;
    const facing = s.heading + s.swing;
    const forwardX = Math.sin(facing);
    const forwardZ = Math.cos(facing);
    const sideX = Math.cos(facing);
    const sideZ = -Math.sin(facing);
    const persp = camera as THREE.PerspectiveCamera;

    let camX: number;
    let camY: number;
    let camZ: number;
    let lookX: number;
    let lookY: number;
    let lookZ: number;

    if (mode === 3) {
      // First-person: pull back just enough that the dozer blade peeks into the lower frame.
      const back = 1.48;
      const lookAhead = 5.1;
      const side = 0.36;
      const fov = 54;
      if (Math.abs(persp.fov - fov) > 0.01) {
        persp.fov = fov;
        persp.updateProjectionMatrix();
      }
      camX = s.posX - forwardX * back + sideX * side;
      camY = 2.9 + baseY;
      camZ = s.posZ - forwardZ * back + sideZ * side;
      lookX = s.posX + forwardX * lookAhead - sideX * 0.22;
      lookY = 1.5 + baseY;
      lookZ = s.posZ + forwardZ * lookAhead - sideZ * 0.22;
    } else {
      if (Math.abs(persp.fov - 58) > 0.01) {
        persp.fov = 58;
        persp.updateProjectionMatrix();
      }

      if (mode === 1) {
        camX = s.posX - forwardX * 11.5 + sideX * 6.2;
        camY = 6.2 + baseY;
        camZ = s.posZ - forwardZ * 11.5 + sideZ * 6.2;
        lookX = s.posX + forwardX * 3.9 - sideX * 0.7;
        lookY = 1.55 + baseY;
        lookZ = s.posZ + forwardZ * 3.9 - sideZ * 0.7;
      } else {
        camX = s.posX - forwardX * 5.9 + sideX * 2.75;
        camY = 3.85 + baseY;
        camZ = s.posZ - forwardZ * 5.9 + sideZ * 2.75;
        lookX = s.posX + forwardX * 2.9 - sideX * 0.45;
        lookY = 1.55 + baseY;
        lookZ = s.posZ + forwardZ * 2.9 - sideZ * 0.45;
      }
    }

    const look = lookOffsetRef.current;
    const travel = inputRef.current?.travel;
    const wantsTravel =
      travel != null &&
      (Math.abs(travel.left) > FREE_LOOK_TRAVEL_THRESHOLD ||
        Math.abs(travel.right) > FREE_LOOK_TRAVEL_THRESHOLD);
    const dt = Math.max(delta, 0);

    if (
      wantsTravel &&
      (look.yaw !== 0 ||
        look.pitch !== 0 ||
        look.distance !== 1 ||
        look.targetYaw !== 0 ||
        look.targetPitch !== 0 ||
        look.targetDistance !== 1)
    ) {
      const k = 1 - Math.exp(-FREE_LOOK_RESET_RATE * dt);
      look.targetYaw += (0 - look.targetYaw) * k;
      look.targetPitch += (0 - look.targetPitch) * k;
      look.targetDistance += (1 - look.targetDistance) * k;
      look.velYaw = 0;
      look.velPitch = 0;
      look.dragging = false;
      look.yaw += (0 - look.yaw) * k;
      look.pitch += (0 - look.pitch) * k;
      look.distance += (1 - look.distance) * k;
      if (Math.abs(look.yaw) < 0.0005) look.yaw = 0;
      if (Math.abs(look.pitch) < 0.0005) look.pitch = 0;
      if (Math.abs(look.distance - 1) < 0.001) look.distance = 1;
      if (Math.abs(look.targetYaw) < 0.0005) look.targetYaw = 0;
      if (Math.abs(look.targetPitch) < 0.0005) look.targetPitch = 0;
      if (Math.abs(look.targetDistance - 1) < 0.001) look.targetDistance = 1;
    } else if (!look.dragging) {
      // Coast after release so orbit keeps moving smoothly.
      if (Math.abs(look.velYaw) > 0.0008 || Math.abs(look.velPitch) > 0.0008) {
        look.targetYaw += look.velYaw * dt;
        look.targetPitch = Math.max(
          FREE_LOOK_PITCH_MIN,
          Math.min(
            FREE_LOOK_PITCH_MAX,
            look.targetPitch + look.velPitch * dt,
          ),
        );
        const damp = Math.exp(-FREE_LOOK_INERTIA_DAMP * dt);
        look.velYaw *= damp;
        look.velPitch *= damp;
        if (Math.abs(look.velYaw) < 0.0008) look.velYaw = 0;
        if (Math.abs(look.velPitch) < 0.0008) look.velPitch = 0;
      }
    }

    {
      const followRate = look.dragging
        ? FREE_LOOK_FOLLOW_RATE
        : FREE_LOOK_FOLLOW_RATE * 0.72;
      const k = 1 - Math.exp(-followRate * dt);
      look.yaw += (look.targetYaw - look.yaw) * k;
      look.pitch += (look.targetPitch - look.pitch) * k;
      look.distance += (look.targetDistance - look.distance) * k;
      if (Math.abs(look.yaw - look.targetYaw) < 0.00015) {
        look.yaw = look.targetYaw;
      }
      if (Math.abs(look.pitch - look.targetPitch) < 0.00015) {
        look.pitch = look.targetPitch;
      }
      if (Math.abs(look.distance - look.targetDistance) < 0.0002) {
        look.distance = look.targetDistance;
      }
    }

    if (look.yaw !== 0 || look.pitch !== 0 || look.distance !== 1) {
      const { offset, right, up } = orbitScratch.current;
      offset.set(camX - lookX, camY - lookY, camZ - lookZ);
      offset.applyAxisAngle(up, look.yaw);
      right.crossVectors(up, offset);
      if (right.lengthSq() < 1e-8) {
        right.set(1, 0, 0);
      } else {
        right.normalize();
      }
      offset.applyAxisAngle(right, look.pitch);
      const distance =
        Number.isFinite(look.distance) && look.distance > 0
          ? look.distance
          : 1;
      offset.multiplyScalar(distance);
      camera.position.set(lookX + offset.x, lookY + offset.y, lookZ + offset.z);
    } else {
      camera.position.set(camX, camY, camZ);
    }

    const groundY = sampleHeight(
      terrainRef.current,
      camera.position.x,
      camera.position.z,
    );
    const minCamY = groundY + FREE_LOOK_MIN_GROUND_CLEARANCE;
    if (Number.isFinite(minCamY) && camera.position.y < minCamY) {
      // Soft lift avoids hard clipping pops while orbiting near slopes.
      const liftK = 1 - Math.exp(-14 * dt);
      camera.position.y +=
        (minCamY - camera.position.y) * Math.max(liftK, 0.35);
    }

    camera.lookAt(lookX, lookY, lookZ);
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
  onCrashTileDestroyed,
  onHillRockDelivered,
  onAttachmentWarning,
  onDumpTruckFull,
  onHaulTruckFull,
  onSimTick,
  endedRef,
  activeChassisId,
  worldPickupsRef,
  onWorldPickup,
}: ExcavatorSceneProps) {
  const runtimeRef = useRef(createSimLoopRuntime());
  const dustRef = useRef<THREE.Group>(null);
  const dumpSoilVisualRef = useRef<DumpSoilVisualState>(runtimeRef.current.dumpSoilVisual);
  const bladeSprayVisualRef = useRef<BladeSprayVisualState>(runtimeRef.current.bladeSpray);
  const dozerBladeReach = getDozerBladeReach(
    getChassisVisualProfile(activeChassisId).scale,
    getChassisVisualProfile(activeChassisId).trackWidth,
  );

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
      onCrashTileDestroyed,
      onHillRockDelivered,
      onAttachmentWarning,
      onDumpTruckFull,
      onHaulTruckFull,
      onSimTick,
      endedRef,
      dozerBladeReach,
      worldPickups: worldPickupsRef?.current ?? null,
      onWorldPickup,
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
    bladeSprayVisualRef.current = runtimeRef.current.bladeSpray;
  });

  return (
    <>
      <DigDustCloud dustRef={dustRef} digFeedbackRef={digFeedbackRef} />
      <DumpSoilParticles visualRef={dumpSoilVisualRef} />
      <BladeSoilSpray visualRef={bladeSprayVisualRef} />
    </>
  );
}

function WaypointMarker({
  tutorialStepRef,
  tutorialWaypointRef,
}: {
  tutorialStepRef: React.RefObject<TutorialStep | null>;
  tutorialWaypointRef?: React.RefObject<TutorialWaypoint | null>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const ring = ringRef.current;
    const wp =
      tutorialWaypointRef?.current ?? tutorialStepRef.current?.waypoint ?? null;
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

const GROUND_PAINT_MATERIAL = {
  transparent: true,
  depthTest: true,
  depthWrite: false,
  // Negative offset pulls paint toward the camera so it sits on top of
  // terrain instead of sinking into mound/soil meshes.
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
  side: THREE.DoubleSide,
  toneMapped: false,
} as const;

/** Sit just above the driveable terrain the machine follows. */
const GROUND_PAINT_LIFT = 0.055;

type NavGuideLabel = "DIG" | "DUMP" | "CRASH" | "STONE";

const NAV_GUIDE_LABELS: Record<NavGuideLabel, string> = {
  DIG: "굴착",
  DUMP: "하역",
  CRASH: "철거",
  STONE: "석재",
};

function createGroundArrowGeometry() {
  // Flat on XZ: tip at +Z so group.rotation.y = atan2(dx, dz) aims at the target.
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    0, 0, 1.05,
    -0.62, 0, -0.55,
    0.62, 0, -0.55,
  ]);
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Point paint: follow local terrain, preferring nearby peaks so dig soil doesn't bury it. */
function groundPaintY(terrain: TerrainData, x: number, z: number) {
  let h = sampleHeight(terrain, x, z);
  const d = 0.55;
  for (const [ox, oz] of [
    [d, 0],
    [-d, 0],
    [0, d],
    [0, -d],
    [d, d],
    [-d, -d],
    [d, -d],
    [-d, d],
  ] as const) {
    h = Math.max(h, sampleHeight(terrain, x + ox, z + oz));
  }
  return h + GROUND_PAINT_LIFT;
}

/**
 * Zone ring paint: sample the outer ring (where the machine crosses), not the
 * mound peak at the center — otherwise the circle floats mid-air through the cab.
 */
function zoneRingPaintY(
  terrain: TerrainData,
  x: number,
  z: number,
  radius: number,
) {
  const samples = 12;
  const heights: number[] = [];
  const ringR = Math.max(1.2, radius * 0.92);
  for (let i = 0; i < samples; i += 1) {
    const angle = (i / samples) * Math.PI * 2;
    heights.push(
      sampleHeight(
        terrain,
        x + Math.cos(angle) * ringR,
        z + Math.sin(angle) * ringR,
      ),
    );
  }
  heights.sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)] ?? heights[0] ?? 0;
  return median + GROUND_PAINT_LIFT;
}

function GroundZoneArrows({
  radius,
  color,
  count = 4,
}: {
  radius: number;
  color: string;
  count?: number;
}) {
  const geometry = useMemo(() => createGroundArrowGeometry(), []);
  const ring = Math.max(2.4, radius - 1.65);

  return (
    <>
      {Array.from({ length: count }, (_, index) => {
        const angle = (index / count) * Math.PI * 2;
        return (
          <mesh
            key={index}
            geometry={geometry}
            position={[Math.sin(angle) * ring, 0.006, Math.cos(angle) * ring]}
            // Tip is +Z; face inward toward zone center.
            rotation={[0, angle + Math.PI, 0]}
            scale={[1.15, 1.15, 1]}
            renderOrder={0}
          >
            <meshBasicMaterial color={color} opacity={0.88} {...GROUND_PAINT_MATERIAL} />
          </mesh>
        );
      })}
    </>
  );
}

function ZoneMarkers({
  terrainRef,
  simRef,
  equipmentStatsRef,
}: {
  terrainRef: React.MutableRefObject<TerrainData>;
  simRef: React.MutableRefObject<ExcavatorSimState>;
  equipmentStatsRef: React.RefObject<YanmarEquipmentStats>;
}) {
  const [zones, setZones] = useState(() =>
    getActiveDigZones(terrainRef.current).map((zone) => ({ ...zone })),
  );
  const [occupiedDigIds, setOccupiedDigIds] = useState<string[]>([]);
  const [inCrashZone, setInCrashZone] = useState(false);
  const [inHillZone, setInHillZone] = useState(false);
  const [, setSpecialVersion] = useState(0);
  const signatureRef = useRef("");
  const digGroupRefs = useRef(new Map<string, THREE.Group>());
  const dumpGroupRef = useRef<THREE.Group>(null);
  const dumpBedMeshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const terrain = terrainRef.current;
    const sim = simRef.current;
    const nextZones = getActiveDigZones(terrain);
    const crash = terrain.crashZone;
    const hill = terrain.hillZone;
    const nextOccupiedDigIds = nextZones
      .filter((zone) => Math.hypot(zone.x - sim.posX, zone.z - sim.posZ) < zone.radius)
      .map((zone) => zone.id)
      .sort();
    const nextInCrash = isInCrashZone(terrain, sim.posX, sim.posZ);
    const nextInHill =
      !!hill?.active &&
      Math.hypot(sim.posX - hill.centerX, sim.posZ - hill.centerZ) <= hill.radius * 0.55;
    const signature = nextZones
      .map(
        (zone) =>
          `${zone.id}:${zone.x.toFixed(1)}:${zone.z.toFixed(1)}:${zone.active}:${
            Math.floor(zone.remainingUnits / 25)
          }`,
      )
      .join("|") +
      `|crash:${crash?.active}:${Math.ceil(getCrashZoneRespawnEtaSec(crash))}:${crash?.tiles.map((tile) => tile.hp).join(",")}` +
      `|hill:${hill?.active}:${Math.ceil(getHillZoneRespawnEtaSec(hill))}:${hill?.haulTruck.phase}:${hill?.haulTruck.loadCount}:${hill?.boulders
        .map((rock) => `${rock.id}:${rock.active}:${rock.delivered}:${rock.extracted}`)
        .join(",")}` +
      `|occDig:${nextOccupiedDigIds.join(",")}` +
      `|occCrash:${nextInCrash}` +
      `|occHill:${nextInHill}`;
    if (signature !== signatureRef.current) {
      signatureRef.current = signature;
      setZones(nextZones.map((zone) => ({ ...zone })));
      setOccupiedDigIds(nextOccupiedDigIds);
      setInCrashZone(nextInCrash);
      setInHillZone(nextInHill);
      setSpecialVersion((value) => value + 1);
    }

    // Keep zone paint on the driveable ring height every frame (dig mounds change).
    for (const zone of nextZones) {
      const group = digGroupRefs.current.get(zone.id);
      if (group) {
        group.position.y = zoneRingPaintY(terrain, zone.x, zone.z, zone.radius);
      }
    }
    if (dumpGroupRef.current) {
      dumpGroupRef.current.position.y = zoneRingPaintY(
        terrain,
        DUMP_ZONE.x,
        DUMP_ZONE.z,
        DUMP_ZONE.radius,
      );
    }
    if (dumpBedMeshRef.current) {
      dumpBedMeshRef.current.position.y =
        groundPaintY(terrain, DUMP_TRUCK_BED.centerX, DUMP_TRUCK_BED.centerZ) + 0.004;
    }
  });

  const terrain = terrainRef.current;
  const crash = terrain.crashZone;
  const hill = terrain.hillZone;
  const dumpPaintY = zoneRingPaintY(
    terrain,
    DUMP_ZONE.x,
    DUMP_ZONE.z,
    DUMP_ZONE.radius,
  );
  const dumpBedPaintY = groundPaintY(
    terrain,
    DUMP_TRUCK_BED.centerX,
    DUMP_TRUCK_BED.centerZ,
  );
  const occupiedDigSet = useMemo(() => new Set(occupiedDigIds), [occupiedDigIds]);

  return (
    <>
      {zones.map((zone) => {
        const paintY = zoneRingPaintY(terrain, zone.x, zone.z, zone.radius);
        const inside = occupiedDigSet.has(zone.id);
        return (
          <group
            key={zone.id}
            position={[zone.x, paintY, zone.z]}
            ref={(node) => {
              if (node) digGroupRefs.current.set(zone.id, node);
              else digGroupRefs.current.delete(zone.id);
            }}
          >
            {inside ? (
              <>
                {/* Inside dig: highlight diggable dirt edge only */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
                  <ringGeometry args={[zone.radius - 0.22, zone.radius + 0.18, 64]} />
                  <meshBasicMaterial color="#d4a574" opacity={0.92} {...GROUND_PAINT_MATERIAL} />
                </mesh>
                <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
                  <ringGeometry args={[zone.radius - 0.55, zone.radius - 0.32, 64]} />
                  <meshBasicMaterial color="#f0c98a" opacity={0.75} {...GROUND_PAINT_MATERIAL} />
                </mesh>
              </>
            ) : (
              <>
                {/* Outside dig: region wayfinding paint */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
                  <circleGeometry args={[zone.radius, 48]} />
                  <meshBasicMaterial color="#ff8f00" opacity={0.2} {...GROUND_PAINT_MATERIAL} />
                </mesh>
                <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
                  <ringGeometry args={[zone.radius - 0.28, zone.radius + 0.12, 64]} />
                  <meshBasicMaterial color="#ffb300" opacity={0.85} {...GROUND_PAINT_MATERIAL} />
                </mesh>
                <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
                  <ringGeometry args={[zone.radius - 1.05, zone.radius - 0.78, 64]} />
                  <meshBasicMaterial color="#fff2a8" opacity={0.5} {...GROUND_PAINT_MATERIAL} />
                </mesh>
                <GroundZoneArrows radius={zone.radius} color="#ffe082" />
                <Text
                  position={[0, 0.006, -zone.radius - 1.15]}
                  rotation={[-Math.PI / 2, 0, Math.PI]}
                  fontSize={1.7}
                  color="#fff7c7"
                  anchorX="center"
                  anchorY="middle"
                  outlineWidth={0.07}
                  outlineColor="#6d3e00"
                  renderOrder={0}
                  material-depthTest={true}
                  material-depthWrite={false}
                  material-transparent
                  material-polygonOffset
                  material-polygonOffsetFactor={-2}
                  material-polygonOffsetUnits={-2}
                  material-toneMapped={false}
                >
                  {`${digZoneLabel(zone.id)} · 흙 ${Math.max(
                    0,
                    Math.ceil(zone.remainingUnits / 10) * 10,
                  ).toLocaleString("ko-KR")} / ${zone.capacityUnits.toLocaleString("ko-KR")}`}
                </Text>
              </>
            )}
          </group>
        );
      })}
      {crash ? (
        <CrashZoneDecor
          zone={crash}
          terrain={terrain}
          showZoneLabel={!inCrashZone || !crash.active}
          highlightTiles={inCrashZone}
        />
      ) : null}
      {hill ? (
        <HillZoneDecor
          zone={hill}
          terrain={terrain}
          showZonePaint={!inHillZone || !hill.active}
          highlightBoulders={inHillZone && hill.active}
        />
      ) : null}
      <HaulTruckWorldHud terrainRef={terrainRef} statsRef={equipmentStatsRef} />
      <group ref={dumpGroupRef} position={[DUMP_ZONE.x, dumpPaintY, DUMP_ZONE.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
          <circleGeometry args={[DUMP_ZONE.radius, 40]} />
          <meshBasicMaterial color="#1b5e20" opacity={0.18} {...GROUND_PAINT_MATERIAL} />
        </mesh>
        <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
          <ringGeometry args={[DUMP_ZONE.radius - 0.28, DUMP_ZONE.radius + 0.12, 48]} />
          <meshBasicMaterial color="#66bb6a" opacity={0.85} {...GROUND_PAINT_MATERIAL} />
        </mesh>
        <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
          <ringGeometry args={[DUMP_ZONE.radius - 0.95, DUMP_ZONE.radius - 0.68, 48]} />
          <meshBasicMaterial color="#d5ffd9" opacity={0.48} {...GROUND_PAINT_MATERIAL} />
        </mesh>
        <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
          <planeGeometry args={[DUMP_TRUCK_BED.width + 0.6, DUMP_TRUCK_BED.depth + 0.6]} />
          <meshBasicMaterial color="#a5d6a7" opacity={0.45} {...GROUND_PAINT_MATERIAL} />
        </mesh>
        <GroundZoneArrows radius={DUMP_ZONE.radius} color="#a5f3a8" />
        <Text
          position={[0, 0.006, -DUMP_ZONE.radius - 1.1]}
          rotation={[-Math.PI / 2, 0, Math.PI]}
          fontSize={1.55}
          color="#d7ffd9"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.07}
          outlineColor="#0c3d16"
          renderOrder={0}
          material-depthTest={true}
          material-depthWrite={false}
          material-transparent
          material-polygonOffset
          material-polygonOffsetFactor={-2}
          material-polygonOffsetUnits={-2}
          material-toneMapped={false}
        >
          하역
        </Text>
      </group>
      <mesh
        ref={dumpBedMeshRef}
        position={[DUMP_TRUCK_BED.centerX, dumpBedPaintY + 0.004, DUMP_TRUCK_BED.centerZ]}
        rotation={[-Math.PI / 2, 0, DUMP_TRUCK_BED.rotation]}
        renderOrder={0}
      >
        <planeGeometry args={[DUMP_TRUCK_BED.width, DUMP_TRUCK_BED.depth]} />
        <meshBasicMaterial color="#b8ffba" opacity={0.32} {...GROUND_PAINT_MATERIAL} />
      </mesh>
    </>
  );
}

function TierBoundaryBarriers({
  terrainRef,
  terrainRevision = 0,
}: {
  terrainRef: React.MutableRefObject<TerrainData>;
  terrainRevision?: number;
}) {
  const terrain = terrainRef.current;
  void terrainRevision;
  const eastLocked = terrain.mapTier < 2;
  const northLocked = terrain.mapTier < 3;
  const coreMaxX = terrain.originX + 64 * terrain.cellSize;
  const coreMaxZ = terrain.originZ + 64 * terrain.cellSize;
  const fenceColor = "#ef4444";
  const buildFence = (
    axis: "x" | "z",
    fixed: number,
    start: number,
    end: number,
    level: number,
  ) => {
    const length = end - start;
    return (
      <group key={`${axis}-${level}`}>
        {Array.from({ length: Math.floor(length / 8) + 1 }, (_, index) => {
          const along = start + Math.min(length, index * 8);
          const x = axis === "x" ? fixed : along;
          const z = axis === "z" ? fixed : along;
          return (
            <mesh key={index} position={[x, 1.2, z]} castShadow>
              <boxGeometry args={[0.16, 2.4, 0.16]} />
              <meshStandardMaterial color="#475569" metalness={0.65} roughness={0.4} />
            </mesh>
          );
        })}
        <mesh
          position={[
            axis === "x" ? fixed : (start + end) / 2,
            1.25,
            axis === "z" ? fixed : (start + end) / 2,
          ]}
        >
          <boxGeometry
            args={[
              axis === "x" ? 0.1 : length,
              0.16,
              axis === "z" ? 0.1 : length,
            ]}
          />
          <meshStandardMaterial color={fenceColor} />
        </mesh>
        <Billboard
          position={[
            axis === "x" ? fixed - 0.3 : (start + end) / 2,
            2.4,
            axis === "z" ? fixed - 0.3 : (start + end) / 2,
          ]}
        >
          <Text
            fontSize={0.9}
            color="#ffffff"
            outlineWidth={0.08}
            outlineColor="#7f1d1d"
          >
            {`Lv.${level} 작업장 확장`}
          </Text>
        </Billboard>
      </group>
    );
  };

  return (
    <>
      {eastLocked
        ? buildFence("x", coreMaxX - 0.5, terrain.originZ, coreMaxZ, 10)
        : null}
      {northLocked
        ? buildFence(
            "z",
            coreMaxZ - 0.5,
            terrain.originX,
            terrain.originX + terrain.gridSizeX * terrain.cellSize,
            15,
          )
        : null}
    </>
  );
}

interface NavigationTarget {
  label: NavGuideLabel;
  x: number;
  z: number;
  color: string;
  outline: string;
  distance: number;
}

function NavigationGuide({
  simRef,
  terrainRef,
  cameraMode,
}: {
  simRef: React.MutableRefObject<ExcavatorSimState>;
  terrainRef: React.MutableRefObject<TerrainData>;
  cameraMode: CameraMode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const targetRef = useRef<NavigationTarget | null>(null);
  const [target, setTarget] = useState<NavigationTarget | null>(null);
  const updateRef = useRef(0);
  const arrowGeometry = useMemo(() => createGroundArrowGeometry(), []);
  targetRef.current = target;

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (now - updateRef.current >= 0.12) {
      updateRef.current = now;

      const sim = simRef.current;
      const terrain = terrainRef.current;
      const zones = getActiveDigZones(terrain);
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
      const crash = terrain.crashZone;
      const hill = terrain.hillZone;
      const inCrash = isInCrashZone(terrain, sim.posX, sim.posZ);
      const inHill = isInHillZone(terrain, sim.posX, sim.posZ);
      const nearHillDrop =
        hill != null &&
        Math.hypot(sim.posX - hill.dropX, sim.posZ - hill.dropZ) <= 6;
      // Hide nav once the player has reached the attachment destination.
      const arrivedAtCrashWork =
        sim.attachmentType === "breaker" && Boolean(crash?.active) && inCrash;
      const arrivedAtStoneWork =
        sim.attachmentType === "grapple" &&
        Boolean(hill?.active) &&
        !sim.carriedBoulderId &&
        inHill;
      const arrivedAtStoneDrop =
        sim.attachmentType === "grapple" &&
        Boolean(sim.carriedBoulderId) &&
        nearHillDrop;

      const guideToCrash =
        sim.attachmentType === "breaker" && crash?.active && !inCrash;
      const guideToHill =
        sim.attachmentType === "grapple" &&
        hill &&
        (sim.carriedBoulderId
          ? !nearHillDrop
          : hill.active && !inHill);

      const next =
        arrivedAtCrashWork || arrivedAtStoneWork || arrivedAtStoneDrop
          ? null
          : guideToCrash && crash
            ? {
                label: "CRASH" as const,
                x: crash.centerX,
                z: crash.centerZ,
                color: "#fbbf24",
                outline: "#451a03",
              }
            : guideToHill && hill
              ? {
                  label: "STONE" as const,
                  x: sim.carriedBoulderId ? hill.dropX : hill.centerX,
                  z: sim.carriedBoulderId ? hill.dropZ : hill.centerZ,
                  color: "#e2e8f0",
                  outline: "#172554",
                }
              : inDig || (!inDump && sim.bucketLoad > 0.08)
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

      if (!next) {
        setTarget((current) => (current == null ? current : null));
      } else {
        const distance = Math.max(
          0,
          Math.hypot(next.x - sim.posX, next.z - sim.posZ),
        );
        setTarget((current) =>
          current?.label === next.label &&
          Math.abs(current.x - next.x) < 0.1 &&
          Math.abs(current.z - next.z) < 0.1 &&
          Math.abs(current.distance - distance) < 0.5
            ? current
            : { ...next, distance },
        );
      }
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
    // Camera 1/2: place the ground guide about 5m ahead of the machine.
    const nearMachine = cameraMode === 1 || cameraMode === 2;
    const guideDistance = nearMachine
      ? Math.min(5, length * 0.95)
      : Math.min(8, Math.max(4.2, length * 0.28));
    const x = sim.posX + (dx / length) * guideDistance;
    const z = sim.posZ + (dz / length) * guideDistance;
    const groundY = groundPaintY(terrainRef.current, x, z);

    group.visible = length > 1.2;
    group.position.set(x, groundY, z);
    // Local +Z is the arrow tip; yaw so +Z faces the destination.
    group.rotation.set(0, Math.atan2(dx, dz), 0);
  });

  if (!target) return null;

  const meterText = `${NAV_GUIDE_LABELS[target.label]} ${Math.round(target.distance)}m`;

  return (
    <group ref={groupRef} renderOrder={0}>
      <mesh
        geometry={arrowGeometry}
        position={[0, 0.004, 0.55]}
        scale={[1.35, 1, 1.55]}
        renderOrder={0}
      >
        <meshBasicMaterial color={target.color} opacity={0.96} {...GROUND_PAINT_MATERIAL} />
      </mesh>
      <mesh
        geometry={arrowGeometry}
        position={[0, 0.002, -0.35]}
        scale={[0.95, 1, 1.05]}
        renderOrder={0}
      >
        <meshBasicMaterial color={target.color} opacity={0.72} {...GROUND_PAINT_MATERIAL} />
      </mesh>
      <Text
        position={[0, 0.006, -1.45]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
        fontSize={0.78}
        color={target.color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor={target.outline}
        renderOrder={0}
        material-depthTest={true}
        material-depthWrite={false}
        material-transparent
        material-polygonOffset
        material-polygonOffsetFactor={-2}
        material-polygonOffsetUnits={-2}
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
    const cooldownSec = stats?.truckCooldownSec ?? 300;
    const pose = getDumpTruckPose(state);
    const group = groupRef.current;
    const label = labelRef.current;

    if (group) {
      if (state.phase === "cooldown") {
        group.position.set(DUMP_TRUCK_BED.x, DUMP_TRUCK_GROUP_Y + 2.9, DUMP_TRUCK_BED.z);
      } else {
        group.position.set(pose.groupX, DUMP_TRUCK_GROUP_Y + 2.9, pose.groupZ);
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

function HaulTruckWorldHud({
  terrainRef,
  statsRef,
}: {
  terrainRef: React.MutableRefObject<TerrainData>;
  statsRef: React.RefObject<YanmarEquipmentStats>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const labelRef = useRef<THREE.Object3D & { text?: string }>(null);

  useFrame(() => {
    const hill = terrainRef.current.hillZone;
    const truck = hill?.haulTruck;
    const stats = statsRef.current;
    const capacity = Math.max(
      1,
      Math.floor(stats?.haulTruckCapacity ?? HAUL_TRUCK_CAPACITY),
    );
    const cooldownSec = stats?.haulTruckCooldownSec ?? 300;
    const group = groupRef.current;
    const label = labelRef.current;

    if (!hill || !truck) {
      if (group) group.visible = false;
      return;
    }

    if (group) {
      const ground = sampleHeight(terrainRef.current, hill.dropX, hill.dropZ);
      group.position.set(hill.dropX, ground + 3.55, hill.dropZ);
      group.visible =
        truck.phase === "cooldown" ||
        isHaulTruckVisible(truck) ||
        shouldShowHaulTruckReturnTimer(truck);
    }

    if (!label || !("text" in label)) return;

    if (shouldShowHaulTruckReturnTimer(truck)) {
      label.text = `복귀 ${formatDumpTruckReturnTime(
        getHaulTruckReturnEtaSec(truck, cooldownSec),
      )}`;
      return;
    }

    label.text = `${truck.loadCount}/${capacity}`;
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
          0/5
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
    group.position.set(pose.groupX, DUMP_TRUCK_GROUP_Y, pose.groupZ);
    group.rotation.y = DUMP_TRUCK_BED.rotation + pose.rotationYOffset;
    group.visible = isDumpTruckVisible(state);

    body.position.y = DUMP_TRUCK_BODY_LOCAL_Y;
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
      body.position.y =
        DUMP_TRUCK_BODY_LOCAL_Y + Math.sin(state.phaseElapsed * 28) * 0.022 * ramp;
      body.rotation.z = Math.sin(state.phaseElapsed * 19) * 0.012 * ramp;
    } else if (
      motion.kind === "arriving" &&
      motion.sub === "park"
    ) {
      const parkT = (motion.t - 0.86) / 0.14;
      const settle = Math.sin(parkT * Math.PI) * (1 - parkT);
      body.rotation.y = settle * 0.018;
      body.position.y = DUMP_TRUCK_BODY_LOCAL_Y - settle * 0.012;
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

  const legacyModelEnabled = false as boolean;

  return (
    <group ref={groupRef}>
      {legacyModelEnabled ? (
        <>
      <group ref={bodyRef} position={[0.3, 0.78, 0]} visible={false}>
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
          visible={false}
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
        visible={false}
        position={[0.05, 2.65, -1.88]}
        rotation={[0, 0, 0]}
        fontSize={0.72}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.035}
        outlineColor="#8a1010"
      >
        흙 하역
      </Text>
        </>
      ) : null}
      <PremiumDumpTruckModel
        bodyRef={bodyRef}
        fillMeshRef={fillMeshRef}
        exhaustRef={exhaustRef}
        wheelRefs={wheelRefs}
      />
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

function createSkyVaultTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.Texture();
  }
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#5fa8dc");
  gradient.addColorStop(0.35, "#8ec6e8");
  gradient.addColorStop(0.7, "#b7d9ee");
  gradient.addColorStop(1, "#cfe4f0");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function Cloud({
  x,
  y,
  z,
  scale = 1,
  opacity = 0.78,
}: {
  x: number;
  y: number;
  z: number;
  scale?: number;
  opacity?: number;
}) {
  const puffs = [
    [-1.55, 0.02, 0.08, 0.95],
    [-0.85, 0.32, -0.18, 1.28],
    [-0.15, 0.48, 0.06, 1.42],
    [0.7, 0.3, -0.12, 1.18],
    [1.45, 0.04, 0.14, 0.88],
    [0.2, -0.18, 0.22, 0.92],
    [0.95, -0.12, -0.28, 0.78],
    [-0.45, -0.08, -0.3, 0.72],
  ] as const;

  return (
    <group position={[x, y, z]} scale={[scale, scale * 0.72, scale]}>
      {puffs.map(([px, py, pz, s], i) => (
        <mesh key={i} position={[px, py, pz]}>
          <sphereGeometry args={[1.05 * s, 18, 12]} />
          <meshBasicMaterial
            color={i % 3 === 0 ? "#f4f9ff" : "#eef6fd"}
            transparent
            opacity={opacity * (0.72 + (i % 4) * 0.06)}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function CinematicBackdrop() {
  const loadedTexture = useLoader(
    THREE.TextureLoader,
    PREMIUM_SITE_TEXTURES.backdrop,
  );
  const texture = useMemo(() => loadedTexture.clone(), [loadedTexture]);
  const skyVaultTexture = useMemo(() => createSkyVaultTexture(), []);
  useLayoutEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    // A mirrored repeat avoids the visible hard cuts produced by four flat
    // billboards while preserving the source image's non-panoramic aspect.
    texture.wrapS = THREE.MirroredRepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(4, 1);
    texture.anisotropy = 8;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.needsUpdate = true;
    return () => {
      texture.dispose();
      skyVaultTexture.dispose();
    };
  }, [texture, skyVaultTexture]);

  return (
    <group>
      <mesh
        position={[48, 62, 48]}
        rotation={[0, Math.PI * 0.18, 0]}
        renderOrder={-10}
      >
        <cylinderGeometry args={[170, 170, 130, 128, 1, true]} />
        <meshBasicMaterial
          map={texture}
          color="#ffffff"
          fog={false}
          toneMapped={false}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
      {/* Close the open cylinder top so free-look upward never shows a hole. */}
      <mesh position={[48, 127, 48]} scale={[1, 0.55, 1]} renderOrder={-11}>
        <sphereGeometry args={[170, 64, 28, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshBasicMaterial
          map={skyVaultTexture}
          fog={false}
          toneMapped={false}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function SunnySky() {
  return (
    <>
      <Billboard position={[48, 46, -78]} follow lockX={false} lockY={false} lockZ={false}>
        <mesh renderOrder={-8}>
          <circleGeometry args={[11.5, 48]} />
          <meshBasicMaterial
            color="#ffd27a"
            transparent
            opacity={0.1}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh renderOrder={-7}>
          <circleGeometry args={[7.2, 48]} />
          <meshBasicMaterial
            color="#ffe29a"
            transparent
            opacity={0.22}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh renderOrder={-6}>
          <circleGeometry args={[4.4, 48]} />
          <meshBasicMaterial
            color="#fff1b8"
            transparent
            opacity={0.55}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh renderOrder={-5}>
          <circleGeometry args={[2.55, 48]} />
          <meshBasicMaterial
            color="#fffdf2"
            transparent
            opacity={0.96}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
      <Cloud x={-42} y={26} z={-58} scale={3.1} opacity={0.8} />
      <Cloud x={-14} y={31} z={-76} scale={2.55} opacity={0.74} />
      <Cloud x={18} y={24} z={-52} scale={2.15} opacity={0.78} />
      <Cloud x={46} y={33} z={-82} scale={2.9} opacity={0.76} />
      <Cloud x={68} y={28} z={-40} scale={2.35} opacity={0.7} />
      <Cloud x={-58} y={29} z={-28} scale={2.2} opacity={0.72} />
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

/**
 * Mounts only after Canvas Suspense resolves (all useLoader textures ready).
 * Waits two rendered frames so the first paint is on screen before reveal.
 */
function SceneReadySignal({ onReady }: { onReady?: () => void }) {
  const firedRef = useRef(false);
  const framesRef = useRef(0);

  useFrame(() => {
    if (firedRef.current || !onReady) return;
    framesRef.current += 1;
    if (framesRef.current < 2) return;
    firedRef.current = true;
    queueMicrotask(() => onReady());
  });

  return null;
}

function SceneContent(props: ExcavatorSceneProps) {
  const terrainRevision = props.terrainRevision ?? 0;
  return (
    <>
      <color attach="background" args={["#8ec6e8"]} />
      <fog attach="fog" args={["#c5dce8", 140, 310]} />
      <hemisphereLight args={["#f1f7f7", "#8f6644", 0.86]} />
      <ambientLight intensity={0.28} />
      <directionalLight
        position={[-42, 58, -54]}
        intensity={3.15}
        color="#fff0c9"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-125}
        shadow-camera-right={125}
        shadow-camera-top={125}
        shadow-camera-bottom={-125}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-bias={-0.00022}
        shadow-normalBias={0.035}
      />
      <directionalLight position={[72, 30, 48]} intensity={0.62} color="#b9d8ef" />
      <pointLight position={[18, 20, -28]} intensity={0.38} color="#ffe9b0" distance={78} />
      <SunnySky />
      <CinematicBackdrop />
      <TerrainMesh terrainRef={props.terrainRef} terrainRevision={terrainRevision} />
      <MapSiteDecor
        key={`decor-${terrainRevision}`}
        terrainRef={props.terrainRef}
        simRef={props.simRef}
      />
      <RepairTent
        x={REPAIR_TENT.x}
        z={REPAIR_TENT.z}
        radius={REPAIR_TENT.radius}
        rotationY={REPAIR_TENT.rotationY}
      />
      <WorkshopSigns
        key={`workshop-signs-${terrainRevision}`}
        mapTier={props.terrainRef.current.mapTier}
        claimableIds={props.workshopClaimableIds ?? []}
      />
      <MonumentPylon
        phase={props.monumentPhase ?? "locked"}
        starsStored={props.monumentStarsStored ?? 0}
        storageCap={props.monumentStorageCap}
      />
      <TerrainRockScatter key={`rocks-${terrainRevision}`} terrainRef={props.terrainRef} />
      <ContactShadows
        position={[48, 0.12, 48]}
        scale={205}
        opacity={0.24}
        blur={2.8}
        far={38}
        resolution={512}
        frames={1}
      />
      <WorksiteSetDressing
        dumpTruckStateRef={props.dumpTruckStateRef}
        equipmentStatsRef={props.equipmentStatsRef}
      />
      <ZoneMarkers
        terrainRef={props.terrainRef}
        simRef={props.simRef}
        equipmentStatsRef={props.equipmentStatsRef}
      />
      <TierBoundaryBarriers
        key={`tier-barriers-${terrainRevision}`}
        terrainRef={props.terrainRef}
        terrainRevision={terrainRevision}
      />
      <ExcavatorGroundContact
        simRef={props.simRef}
        terrainRef={props.terrainRef}
      />
      <ExcavatorArm
        simRef={props.simRef}
        velRef={props.velRef}
        terrainRef={props.terrainRef}
        auxiliaryRef={props.auxiliaryRef}
        inputRef={props.inputRef}
        cameraMode={props.cameraMode}
        lookOffsetRef={props.lookOffsetRef}
        activeChassisId={props.activeChassisId}
      />
      <NavigationGuide
        simRef={props.simRef}
        terrainRef={props.terrainRef}
        cameraMode={props.cameraMode}
      />
      <WaypointMarker
        tutorialStepRef={props.tutorialStepRef}
        tutorialWaypointRef={props.tutorialWaypointRef}
      />
      <AuxiliarySceneEffects auxiliaryRef={props.auxiliaryRef} />
      <GameCamera
        simRef={props.simRef}
        mode={props.cameraMode}
        lookOffsetRef={props.lookOffsetRef}
        inputRef={props.inputRef}
        terrainRef={props.terrainRef}
      />
      {props.worldPickupsRef ? (
        <WorldPickupMeshes
          pickupsRef={props.worldPickupsRef}
          revision={props.worldPickupRevision ?? 0}
        />
      ) : null}
      <SimLoop {...props} />
      <SceneReadySignal onReady={props.onSceneReady} />
    </>
  );
}

export function ExcavatorScene(props: ExcavatorSceneProps) {
  const [glRecoveryKey, setGlRecoveryKey] = useState(0);
  const recoveringRef = useRef(false);

  return (
    <Canvas
      key={glRecoveryKey}
      shadows="percentage"
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        alpha: false,
        stencil: false,
      }}
      dpr={[1, 1.5]}
      camera={{ fov: 58, near: 0.1, far: 420 }}
      style={{ width: "100%", height: "100%", background: "#8ec6e8" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.setClearColor("#8ec6e8", 1);

        const canvas = gl.domElement;
        const onContextLost = (event: Event) => {
          event.preventDefault();
          if (recoveringRef.current) return;
          recoveringRef.current = true;
          // Prefer browser restore; only remount Canvas if context never comes back.
          const fallback = window.setTimeout(() => {
            setGlRecoveryKey((key) => key + 1);
            recoveringRef.current = false;
          }, 1200);
          const onRestored = () => {
            window.clearTimeout(fallback);
            recoveringRef.current = false;
            canvas.removeEventListener("webglcontextrestored", onRestored);
            try {
              gl.setSize(canvas.clientWidth, canvas.clientHeight, false);
            } catch {
              // ignore
            }
          };
          canvas.addEventListener("webglcontextrestored", onRestored, {
            once: true,
          });
        };
        canvas.addEventListener("webglcontextlost", onContextLost, false);
      }}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}

export function createInitialSim(): ExcavatorSimState {
  return {
    swing: 0,
    boom: 0.55,
    arm: -0.95,
    bucket: 0.85,
    posX: -18,
    posY: 0,
    posZ: -22,
    heading: 0,
    bucketLoad: 0,
    attachmentType: "bucket",
    carriedBoulderId: null,
  };
}

export function createInitialTerrain(
  dynamicDigZones = false,
  playerLevel = 1,
): TerrainData {
  return createTerrain(-48, -48, dynamicDigZones, playerLevel);
}
