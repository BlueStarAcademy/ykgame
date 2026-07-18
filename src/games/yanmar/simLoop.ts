import type { AuxiliaryControlState, ControlMask, ExcavatorControlState, HydraulicVelocity } from "./controls";
import {
  advanceAutoArmPose,
  applyControls,
  buildAutoArmControlInput,
  cancelAutoArmPose,
  getActiveAutoPoseJoint,
  getAutoDigPoseReadiness,
  hasManualControlInput,
  isAutoPoseDigLoadingActive,
  CONTROL_SPEED,
  DEFAULT_BOOM_SWING,
  RIDE_CONTROL_SPEED,
  canLoadBucket as isBucketCurled,
  filterInput,
} from "./controls";
import type { AutoPoseState } from "./types";
import {
  digAt,
  consumeDigZoneUnits,
  getActiveDigZoneAt,
  getActiveDigZones,
  isInDigZone,
  isInDumpZone,
  clampToDumpTruckBed,
  dumpTruckBedCenterWorld,
  dumpTruckBedDeckWorldY,
  getMapWorldBounds,
  addHaulTruckRock,
  beginHaulTruckDeparture,
  canHaulTruckAcceptRock,
  getHaulTruckFillRatio,
  getHaulTruckReturnEtaSec,
  damageCrashTile,
  getCrashTileAt,
  isInsideHillZoneCore,
  isInDumpTruckBed,
  markHillRockExtracted,
  tryClearHillZone,
  digZoneLabel,
  getDigZoneRespawnEtaSec,
  getCrashZoneRespawnEtaSec,
  getHillZoneRespawnEtaSec,
  sampleBreakerContactHeight,
  sampleCrashContactHeight,
  sampleHeight,
  updateDigZoneRespawns,
  updateSpecialZones,
  fastForwardHaulTruckState,
  worldToDumpTruckLocal,
  dumpTruckLocalToWorld,
  hillBoulderVisualScale,
  type TerrainData,
  type HillBoulder,
  DUMP_ZONE,
  DUMP_TRUCK,
} from "./terrain";
import {
  constrainArmFromHaulTruck,
  constrainExcavatorToTruckTarget,
  getDumpTruckAlignTarget,
  getHaulTruckAlignTarget,
  isAlignedForTruckDump,
  isBodyTouchingTruck,
  isFacingTruckBedCenter,
} from "./truckDumpAlign";
import { checkAttachmentUse, getZoneAt } from "./attachmentZones";
import {
  BUCKET_SOIL_HOLD_MIN,
  getArmCollisionSamples,
  getBreakerGroundAngleDeg,
  getBreakerTipWorld,
  getBucketBodyContactWorld,
  getGrappleClampWorld,
  getGrappleJawSampleWorlds,
  getBucketScraperContactWorld,
  getBucketSoilRetention,
  getBucketTipWorld,
  getDozerBladeContactWorld,
  getMaxDozerBladeFromGround,
  MIN_BREAKER_GROUND_ANGLE_DEG,
  type DigFeedback,
} from "./bucket";
import { constrainArmFromDumpTruck, isDumpTruckArmCollisionActive } from "./dumpTruckCollision";
import {
  addDumpTruckLoad,
  beginDumpTruckDeparture,
  canDumpTruckAcceptDump,
  getDumpTruckFillRatio,
  getDumpTruckPose,
  getDumpTruckReturnEtaSec,
  isDumpTruckVisible,
  type DumpTruckPose,
  type DumpTruckRuntimeState,
  updateDumpTruckState,
  fastForwardDumpTruckState,
} from "./dumpTruckState";
import type { DiggingScoreState } from "./scoring";
import type { GameMode } from "./tutorial";
import { calculateYanmarChunkScore, rollYanmarBreakerDamage, type YanmarEquipmentStats } from "./equipment";
import { YANMAR_MACHINE_RIG } from "./machineVisualTheme";
import type { DumpScorePopup, ExcavatorSimState } from "./types";
import {
  DUMP_TRUCK_COLLIDER,
  EXCAVATOR_COLLISION_RADIUS,
  EXCAVATOR_MAP_WALL_MARGIN,
  BREAKER_TIP_PROBE_RADIUS,
  BREAKER_TOUCH_BAND,
  BREAKER_TRAVEL_LOCK_CLEARANCE,
  MIN_BREAKER_SURFACE_CLEARANCE,
  MIN_BUCKET_DIG_ZONE_CLEARANCE,
  MIN_BUCKET_GROUND_CLEARANCE,
  MIN_GRAPPLE_GROUND_CLEARANCE,
} from "./simConstants";
import {
  isWorldSpeedBuffActive,
  SPEED_BUFF_MULT,
  tickWorldPickups,
  tryCollectWorldPickup,
  type WorldPickup,
  type WorldPickupsState,
} from "./worldPickups";
import {
  computeComAlignFactor,
  computeGrappleAdhesion,
  createGrappleGripRuntime,
  GRAPPLE_GRAB_MIN_OPEN,
  grappleBucketAngleReady,
  hillBoulderGripEnvelope,
  hillBoulderWrapRadius,
  isGrappleClampNearGround,
  isGrappleGroundPickupPose,
  resetGrappleGrip,
  GRAPPLE_LIFT_JUDGE_CLEARANCE_DELTA,
  GRAPPLE_TRAVEL_LOCK_CLEARANCE,
  type GrappleGripRuntime,
} from "./grappleGrip";

export interface DumpSoilVisual {
  active: boolean;
  spawnX: number;
  spawnY: number;
  spawnZ: number;
  intensity: number;
}

export interface DigDustVisual {
  active: boolean;
  x: number;
  y: number;
  z: number;
}

export interface BladeSprayVisual {
  active: boolean;
  x: number;
  y: number;
  z: number;
  heading: number;
  intensity: number;
}

export interface SimLoopRuntime {
  lastReportedProgress: number;
  dumpScoreRemainder: number;
  dumpSoilVisual: DumpSoilVisual;
  digDust: DigDustVisual;
  bladeSpray: BladeSprayVisual;
  attachmentActionCooldown: number;
  breakerHitCount: number;
  warningCooldown: number;
  /** Latches zone/use warnings until the triggering condition clears. */
  warningLatchKey: string | null;
  grappleGrip: GrappleGripRuntime;
  /**
   * 집게가 70% 이상 열린 채 닫기를 시작하면 true.
   * 페달을 떼거나 다시 열기 전까지 유지해, 닫히는 도중에도 지면 집기가 되게 한다.
   */
  grappleGrabArmed: boolean;
  /** 트럭·특수구역 쿨타임용 벽시계 (탭 백그라운드 복귀 시 경과 반영). */
  lastSystemsWallMs: number;
}

export function createSimLoopRuntime(): SimLoopRuntime {
  return {
    lastReportedProgress: -1,
    dumpScoreRemainder: 0,
    dumpSoilVisual: {
      active: false,
      spawnX: 0,
      spawnY: 0,
      spawnZ: 0,
      intensity: 0,
    },
    digDust: { active: false, x: 0, y: 0, z: 0 },
    bladeSpray: {
      active: false,
      x: 0,
      y: 0,
      z: 0,
      heading: 0,
      intensity: 0,
    },
    attachmentActionCooldown: 0,
    breakerHitCount: 0,
    warningCooldown: 0,
    warningLatchKey: null,
    grappleGrip: createGrappleGripRuntime(),
    grappleGrabArmed: false,
    lastSystemsWallMs: 0,
  };
}

export interface SimTickParams {
  dt: number;
  sim: ExcavatorSimState;
  vel: HydraulicVelocity;
  terrain: TerrainData;
  score: DiggingScoreState;
  mode: GameMode;
  stats: YanmarEquipmentStats;
  allowed: ControlMask;
  auxiliary: AuxiliaryControlState;
  autoPose: AutoPoseState;
  rawInput: ExcavatorControlState;
  tutorialDump: { current: number };
  digFeedback: DigFeedback;
  dumpTruckState: DumpTruckRuntimeState;
  dumpTruckPose: DumpTruckPose;
  runtime: SimLoopRuntime;
  onProgress: (dumped: number, progress: number) => void;
  onDumpScore: (popup: Omit<DumpScorePopup, "id">) => void;
  onCrashTileDestroyed: (tileId: string) => void;
  onHillRockDelivered: (rockId: string) => void;
  onAttachmentWarning: (message: string) => void;
  /** 덤프트럭 만재→출발 전환 시 1회 */
  onDumpTruckFull?: () => void;
  /** 돌트럭 만재→출발 전환 시 1회 */
  onHaulTruckFull?: () => void;
  onSimTick: () => void;
  /** true면 덤프 트럭·특수구역 시간 진행을 멈춘다 (결과 화면 등). */
  endedRef?: { current: boolean };
  /** 차체 스케일에 맞춘 도저 전방 reach (미지정 시 기본값). */
  dozerBladeReach?: number;
  /** Arcade world pickups (stars / speed). Game mode + logged-in only. */
  worldPickups?: WorldPickupsState | null;
  onWorldPickup?: (pickup: WorldPickup) => void;
}

function clampControl(value: number, min = -1, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function distancePointToSegment3(
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
) {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;
  const abLenSq = abx * abx + aby * aby + abz * abz;
  const t =
    abLenSq <= 1e-8
      ? 0
      : Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / abLenSq));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  const cz = az + abz * t;
  return Math.hypot(px - cx, py - cy, pz - cz);
}

/**
 * 집게가 바닥 근처에서 돌 위/옆에 오면 잡히도록 한다.
 * 클램프가 공중에 떠 있으면 집기 가능·잡기를 모두 막는다.
 */
function isGrappleWrappingRock(
  samples: ReadonlyArray<{ x: number; y: number; z: number }>,
  clamp: { x: number; y: number; z: number },
  rock: HillBoulder,
  terrain: TerrainData,
): boolean {
  const envelope = hillBoulderGripEnvelope(rock);
  const ground = sampleHeight(terrain, rock.x, rock.z);
  // 벌어진 집게 끝(가장 낮은 샘플) 기준으로 바닥 근접을 본다.
  const lowestY =
    samples.length > 0
      ? Math.min(clamp.y, ...samples.map((p) => p.y))
      : clamp.y;
  if (!isGrappleClampNearGround(lowestY, ground, rock)) {
    return false;
  }

  const scale = hillBoulderVisualScale(rock.size);
  const rockY = ground + scale * 0.55;
  const yMin = ground - 0.35;
  const yMax = rockY + envelope.verticalRadius;

  // 바닥 근처에서 돌 위로 내려온 자세면 입구에 들어온 것으로 본다.
  if (isGrappleGroundPickupPose(clamp, rock, ground)) {
    return true;
  }

  const points = samples.length > 0 ? samples : [clamp];
  for (const point of points) {
    const xz = Math.hypot(point.x - rock.x, point.z - rock.z);
    if (xz <= envelope.horizontalRadius && point.y >= yMin && point.y <= yMax) {
      return true;
    }
  }

  // 차체 근처 폴백 — 클램프만으로도 돌 옆이면 집기
  const clampXz = Math.hypot(clamp.x - rock.x, clamp.z - rock.z);
  if (clampXz <= envelope.horizontalRadius && clamp.y >= yMin && clamp.y <= yMax) {
    return true;
  }

  if (points.length >= 2) {
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      // 세그먼트 양 끝도 돌 높이 근처여야 공중 아크가 잡히지 않는다.
      if (a.y > yMax + 0.2 && b.y > yMax + 0.2) continue;
      const seg = distancePointToSegment3(
        rock.x,
        rockY,
        rock.z,
        a.x,
        a.y,
        a.z,
        b.x,
        b.y,
        b.z,
      );
      if (seg <= envelope.grabRadius) return true;
    }
  }
  return false;
}

function findWrappableHillRock(
  hill: NonNullable<TerrainData["hillZone"]>,
  jawSamples: ReadonlyArray<{ x: number; y: number; z: number }>,
  clamp: { x: number; y: number; z: number },
  terrain: TerrainData,
): HillBoulder | null {
  const candidates = hill.boulders
    .filter((item) => item.active && !item.delivered && !item.extracted)
    .map((item) => ({
      item,
      distance: Math.hypot(item.x - clamp.x, item.z - clamp.z),
    }))
    .sort((a, b) => a.distance - b.distance);

  for (const candidate of candidates) {
    if (
      candidate.distance >
      hillBoulderGripEnvelope(candidate.item).horizontalRadius + 1.2
    ) {
      break;
    }
    if (isGrappleWrappingRock(jawSamples, clamp, candidate.item, terrain)) {
      return candidate.item;
    }
  }
  return null;
}

function placeCarriedRockOnGround(
  rock: HillBoulder,
  tip: { x: number; z: number },
  terrain: TerrainData,
) {
  const bounds = getMapWorldBounds(terrain);
  rock.x = clampControl(tip.x, bounds.minX + 1, bounds.maxX - 1);
  rock.z = clampControl(tip.z, bounds.minZ + 1, bounds.maxZ - 1);
  rock.active = true;
  rock.delivered = false;
  rock.extracted = false;
}

function destroyCarriedRock(rock: HillBoulder) {
  rock.active = false;
  rock.delivered = false;
  rock.extracted = true;
}

function bucketClearance(
  sim: ExcavatorSimState,
  terrain: TerrainData,
  boomSwing: number,
  grappleOpen = 1,
) {
  if (sim.attachmentType === "grapple") {
    const samples = [
      getGrappleClampWorld(sim, boomSwing),
      ...getGrappleJawSampleWorlds(sim, boomSwing, grappleOpen),
    ];
    let tip = samples[0]!;
    let groundH = sampleHeight(terrain, tip.x, tip.z);
    let clearance = tip.y - groundH;
    for (let i = 1; i < samples.length; i++) {
      const sample = samples[i]!;
      const h = sampleHeight(terrain, sample.x, sample.z);
      const c = sample.y - h;
      if (c < clearance) {
        tip = sample;
        groundH = h;
        clearance = c;
      }
    }
    return {
      tip,
      groundH,
      depthBelow: groundH - tip.y,
      clearance,
    };
  }

  const tip =
    sim.attachmentType === "breaker"
      ? getBreakerTipWorld(sim, boomSwing)
      : getBucketBodyContactWorld(sim, boomSwing);
  const groundH =
    sim.attachmentType === "breaker"
      ? sampleBreakerContactHeight(terrain, tip.x, tip.z, BREAKER_TIP_PROBE_RADIUS)
          .height
      : sampleHeight(terrain, tip.x, tip.z);
  return {
    tip,
    groundH,
    depthBelow: groundH - tip.y,
    clearance: tip.y - groundH,
  };
}

function constrainExcavatorToMap(sim: ExcavatorSimState, terrain: TerrainData) {
  const bounds = getMapWorldBounds(terrain);
  const nextX = clampControl(
    sim.posX,
    bounds.minX + EXCAVATOR_MAP_WALL_MARGIN,
    bounds.maxX - EXCAVATOR_MAP_WALL_MARGIN,
  );
  const nextZ = clampControl(
    sim.posZ,
    bounds.minZ + EXCAVATOR_MAP_WALL_MARGIN,
    bounds.maxZ - EXCAVATOR_MAP_WALL_MARGIN,
  );
  const blocked = nextX !== sim.posX || nextZ !== sim.posZ;
  sim.posX = nextX;
  sim.posZ = nextZ;
  return blocked;
}

function applyTruckDump(
  amount: number,
  params: {
    isGame: boolean;
    score: DiggingScoreState;
    stats: YanmarEquipmentStats;
    truckState: DumpTruckRuntimeState;
    truckPose: DumpTruckPose;
    tutorialDump: { current: number };
    runtime: SimLoopRuntime;
    bedDeckY: number;
    bucketReachY: number;
    mouth: { x: number; z: number };
    onProgress: (dumped: number, progress: number) => void;
    onDumpScore: (popup: Omit<DumpScorePopup, "id">) => void;
  },
) {
  if (amount <= 0) return;
  const {
    isGame,
    score,
    stats,
    truckState,
    truckPose,
    tutorialDump,
    runtime,
    bedDeckY,
    bucketReachY,
    mouth,
    onProgress,
    onDumpScore,
  } = params;
  addDumpTruckLoad(truckState, amount * stats.maxLoadUnits, stats.truckCapacityUnits);
  runtime.dumpSoilVisual.active = true;
  runtime.dumpSoilVisual.intensity = Math.min(
    1.2,
    runtime.dumpSoilVisual.intensity + amount * 6.5,
  );
  const visualDropPoint = clampToDumpTruckBed(
    mouth.x,
    mouth.z,
    0.7,
    truckPose.groupX,
    truckPose.groupZ,
  );
  runtime.dumpSoilVisual.spawnX = visualDropPoint.x;
  runtime.dumpSoilVisual.spawnY = Math.max(bucketReachY, bedDeckY + 0.35);
  runtime.dumpSoilVisual.spawnZ = visualDropPoint.z;
  if (isGame) {
    score.dumped += amount;
    const progress = Math.min(100, Math.round((score.dumped / score.target) * 100));
    if (progress !== runtime.lastReportedProgress) {
      runtime.lastReportedProgress = progress;
      onProgress(score.dumped, progress);
    }
  } else {
    tutorialDump.current += amount;
  }
  const chunkRatio = stats.scoreChunkUnits / stats.maxLoadUnits;
  runtime.dumpScoreRemainder += amount;
  while (runtime.dumpScoreRemainder >= chunkRatio) {
    runtime.dumpScoreRemainder -= chunkRatio;
    const critical = Math.random() < stats.criticalChance;
    const dropPoint = clampToDumpTruckBed(
      mouth.x,
      mouth.z,
      0.08,
      truckPose.groupX,
      truckPose.groupZ,
    );
    onDumpScore({
      score: calculateYanmarChunkScore(stats, critical),
      critical,
      x: dropPoint.x,
      y: bedDeckY + 0.22,
      z: dropPoint.z,
    });
  }
}

function isExcavatorCollidingWithDumpTruck(x: number, z: number, pose?: DumpTruckPose) {
  if (pose && !pose.present) return false;
  const local = worldToDumpTruckLocal(x, z, pose?.groupX, pose?.groupZ);
  const localX = local.x - DUMP_TRUCK_COLLIDER.centerOffsetX;
  const localZ = local.z - DUMP_TRUCK_COLLIDER.centerOffsetZ;
  const outsideX = Math.max(Math.abs(localX) - DUMP_TRUCK_COLLIDER.halfX, 0);
  const outsideZ = Math.max(Math.abs(localZ) - DUMP_TRUCK_COLLIDER.halfZ, 0);
  return outsideX * outsideX + outsideZ * outsideZ <= EXCAVATOR_COLLISION_RADIUS ** 2;
}

/** 트럭 OBB + 굴착기 반경 원 겹침을 최단면으로 밀어낸다. */
function resolveExcavatorDumpTruckOverlap(
  x: number,
  z: number,
  pose: DumpTruckPose,
): { x: number; z: number } | null {
  if (!pose.present) return null;
  const local = worldToDumpTruckLocal(x, z, pose.groupX, pose.groupZ);
  const lx = local.x - DUMP_TRUCK_COLLIDER.centerOffsetX;
  const lz = local.z - DUMP_TRUCK_COLLIDER.centerOffsetZ;
  const hx = DUMP_TRUCK_COLLIDER.halfX;
  const hz = DUMP_TRUCK_COLLIDER.halfZ;
  const radius = EXCAVATOR_COLLISION_RADIUS;
  const pad = 0.04;

  const closestX = Math.max(-hx, Math.min(hx, lx));
  const closestZ = Math.max(-hz, Math.min(hz, lz));
  const dx = lx - closestX;
  const dz = lz - closestZ;
  const distSq = dx * dx + dz * dz;

  if (distSq > radius * radius) return null;

  let outLx: number;
  let outLz: number;
  if (distSq < 1e-8) {
    const toPosX = hx - lx;
    const toNegX = hx + lx;
    const toPosZ = hz - lz;
    const toNegZ = hz + lz;
    const nearest = Math.min(toPosX, toNegX, toPosZ, toNegZ);
    if (nearest === toPosX) {
      outLx = hx + radius + pad;
      outLz = lz;
    } else if (nearest === toNegX) {
      outLx = -hx - radius - pad;
      outLz = lz;
    } else if (nearest === toPosZ) {
      outLx = lx;
      outLz = hz + radius + pad;
    } else {
      outLx = lx;
      outLz = -hz - radius - pad;
    }
  } else {
    const dist = Math.sqrt(distSq);
    const scale = (radius + pad) / dist;
    outLx = closestX + dx * scale;
    outLz = closestZ + dz * scale;
  }

  return dumpTruckLocalToWorld(
    outLx + DUMP_TRUCK_COLLIDER.centerOffsetX,
    outLz + DUMP_TRUCK_COLLIDER.centerOffsetZ,
    pose.groupX,
    pose.groupZ,
  );
}

function constrainExcavatorToDumpTruck(
  sim: ExcavatorSimState,
  previous: { x: number; z: number },
  pose?: DumpTruckPose,
) {
  if (!pose || !isExcavatorCollidingWithDumpTruck(sim.posX, sim.posZ, pose)) {
    return false;
  }
  // 평소: 진입 직전 위치로 되돌림. 이미 겹친 상태(복귀 끼임 등)는 밀어낸다.
  if (!isExcavatorCollidingWithDumpTruck(previous.x, previous.z, pose)) {
    sim.posX = previous.x;
    sim.posZ = previous.z;
    return true;
  }
  const resolved = resolveExcavatorDumpTruckOverlap(sim.posX, sim.posZ, pose);
  if (resolved) {
    sim.posX = resolved.x;
    sim.posZ = resolved.z;
  }
  return true;
}

export function tickExcavatorSim(params: SimTickParams) {
  const {
    dt,
    sim,
    vel,
    terrain,
    score,
    mode,
    stats,
    allowed,
    auxiliary,
    autoPose,
    rawInput,
    tutorialDump,
    digFeedback: fb,
    dumpTruckState: truckState,
    runtime,
    onProgress,
    onDumpScore,
    onCrashTileDestroyed,
    onHillRockDelivered,
    onAttachmentWarning,
    onDumpTruckFull,
    onHaulTruckFull,
    onSimTick,
    endedRef,
    dozerBladeReach = YANMAR_MACHINE_RIG.dozerBladeReach,
  } = params;

  const systemsFrozen = endedRef?.current === true;
  if (!systemsFrozen) {
    const nowMs = Date.now();
    const prevWallMs = runtime.lastSystemsWallMs || nowMs;
    runtime.lastSystemsWallMs = nowMs;
    // 프레임 dt는 0.05초로 캡되어 백그라운드 복귀 시 쿨타임이 거의 안 줄어든다.
    // 트럭·특수구역은 벽시계 경과로 따라잡는다.
    const wallDt = Math.min(Math.max(0, (nowMs - prevWallMs) / 1000), 24 * 3600);

    if (wallDt > 0.08) {
      fastForwardDumpTruckState(truckState, wallDt, stats.truckCooldownSec);
      const haulTruck = terrain.hillZone?.haulTruck;
      if (haulTruck) {
        fastForwardHaulTruckState(haulTruck, wallDt, stats.haulTruckCooldownSec);
      }
      updateSpecialZones(
        terrain,
        0,
        nowMs,
        stats.crashRespawnSec,
        stats.haulTruckCooldownSec,
        stats.hillBoulderCount,
        sim.posX,
        sim.posZ,
      );
    } else {
      updateDumpTruckState(truckState, wallDt, stats.truckCooldownSec);
      updateSpecialZones(
        terrain,
        wallDt,
        nowMs,
        stats.crashRespawnSec,
        stats.haulTruckCooldownSec,
        stats.hillBoulderCount,
        sim.posX,
        sim.posZ,
      );
    }
  } else {
    runtime.lastSystemsWallMs = Date.now();
  }
  runtime.attachmentActionCooldown = Math.max(0, runtime.attachmentActionCooldown - dt);
  runtime.warningCooldown = Math.max(0, runtime.warningCooldown - dt);
  const truckPose = getDumpTruckPose(truckState);
  params.dumpTruckPose.groupX = truckPose.groupX;
  params.dumpTruckPose.groupZ = truckPose.groupZ;
  params.dumpTruckPose.present = truckPose.present;

  let filtered = filterInput(rawInput, allowed);
  if (autoPose.executing && hasManualControlInput(rawInput, allowed, auxiliary)) {
    cancelAutoArmPose(autoPose);
  }
  const isAutoArm = autoPose.executing && autoPose.saved != null;

  const isRide = mode === "ride";
  // RPM(고속)연동: 전진·붐·암이 동일 배율. 버켓/선회는 고정.
  const rpmScale = isRide
    ? auxiliary?.highSpeed
      ? 1.15
      : 1
    : auxiliary?.highSpeed
      ? 0.5
      : 0.25;
  const speedProfile = isRide ? RIDE_CONTROL_SPEED : CONTROL_SPEED;
  const nowMs = Date.now();
  const worldBuffActive =
    !!params.worldPickups && isWorldSpeedBuffActive(params.worldPickups, nowMs);
  const travelSpeedScale =
    stats.travelSpeedMultiplier *
    rpmScale *
    (worldBuffActive ? SPEED_BUFF_MULT : 1);
  const workSpeedScale = (stats.workSpeedMultiplier ?? 1) * rpmScale;
  const boomSwing = auxiliary?.boomSwing ?? DEFAULT_BOOM_SWING;
  const grappleOpen = auxiliary?.grappleOpen ?? 1;
  const beforeControlBucket = bucketClearance(sim, terrain, boomSwing, grappleOpen);
  const bucketTipInDigZone = isInDigZone(
    beforeControlBucket.tip.x,
    beforeControlBucket.tip.z,
    terrain,
  );
  const bucketAnchoredToGround =
    sim.attachmentType === "bucket" &&
    bucketTipInDigZone &&
    beforeControlBucket.clearance < -0.05;
  const breakerNearGround =
    sim.attachmentType === "breaker" &&
    beforeControlBucket.clearance < BREAKER_TRAVEL_LOCK_CLEARANCE;
  // Grapple matches breaker: travel is locked while the jaws sit too low,
  // and also while a carried rock has not finished the lift check.
  const grappleNearGround =
    sim.attachmentType === "grapple" &&
    (beforeControlBucket.clearance < GRAPPLE_TRAVEL_LOCK_CLEARANCE ||
      (!!sim.carriedBoulderId && !runtime.grappleGrip.liftChecked));
  const toolBlocksTravel =
    bucketAnchoredToGround || breakerNearGround || grappleNearGround;
  const wantsTravel =
    allowed.travel &&
    (Math.abs(rawInput.travel.left) > 0.08 || Math.abs(rawInput.travel.right) > 0.08);
  if (toolBlocksTravel) {
    filtered = {
      ...filtered,
      travel: { left: 0, right: 0 },
    };
    vel.travel = 0;
    vel.trackTurn = 0;
    vel.trackLeft = 0;
    vel.trackRight = 0;
  }

  // 집게로 돌을 집은 뒤 압력이 올라가는 동안(밀착 확정 전) 붐 상승 금지.
  // 압력 최대·페달 해제로 밀착이 확정되면 붐을 들어 적재 판정한다.
  const blockBoomRaiseWhileGripping =
    sim.attachmentType === "grapple" &&
    !!sim.carriedBoulderId &&
    !runtime.grappleGrip.locked &&
    !runtime.grappleGrip.liftChecked;
  if (blockBoomRaiseWhileGripping) {
    if (filtered.right.y < 0) {
      filtered = {
        ...filtered,
        right: { x: filtered.right.x, y: 0 },
      };
    }
    if (vel.boom < 0) vel.boom = 0;
  }

  // 운반 중: 밀착감 확정 후 붐을 들어 주행 가능이 되면 낙하 판정
  // (유압 이동·클램프 갱신 이후에 판정)

  const beforeGroundContact = {
    boom: sim.boom,
    arm: sim.arm,
    bucket: sim.bucket,
  };
  const beforeTravel = {
    x: sim.posX,
    z: sim.posZ,
  };
  const hillZone = terrain.hillZone;
  const haulTruckPresent =
    !!hillZone && hillZone.haulTruck.phase === "ready";
  const haulAlignForCollision = hillZone
    ? getHaulTruckAlignTarget(hillZone.dropX, hillZone.dropZ, haulTruckPresent)
    : null;
  const haulArmCollisionActive =
    haulTruckPresent &&
    Math.hypot(sim.posX - (hillZone?.dropX ?? 0), sim.posZ - (hillZone?.dropZ ?? 0)) <=
      10;
  const truckArmCollisionActive =
    (truckPose.present && isDumpTruckArmCollisionActive(sim, boomSwing, truckPose)) ||
    haulArmCollisionActive;
  const hydraulicSubsteps = truckArmCollisionActive ? 5 : 1;
  const subDt = dt / hydraulicSubsteps;

  for (let step = 0; step < hydraulicSubsteps; step += 1) {
    const subBefore = {
      boom: sim.boom,
      arm: sim.arm,
      bucket: sim.bucket,
    };
    let stepInput = filtered;
    if (isAutoArm && autoPose.saved) {
      const autoInput = buildAutoArmControlInput(sim, autoPose);
      stepInput = {
        ...filtered,
        left: { x: 0, y: autoInput.left.y },
        right: autoInput.right,
      };
    }
    if (blockBoomRaiseWhileGripping) {
      if (stepInput.right.y < 0) {
        stepInput = {
          ...stepInput,
          right: { x: stepInput.right.x, y: 0 },
        };
      }
      if (vel.boom < 0) vel.boom = 0;
    }
    applyControls(
      sim,
      stepInput,
      subDt,
      vel,
      workSpeedScale,
      travelSpeedScale,
      speedProfile,
    );
    if (blockBoomRaiseWhileGripping && sim.boom < subBefore.boom) {
      sim.boom = subBefore.boom;
      if (vel.boom < 0) vel.boom = 0;
    }
    if (isAutoArm) {
      advanceAutoArmPose(sim, vel, autoPose);
    }
    constrainArmFromDumpTruck(sim, vel, boomSwing, subBefore, truckPose);
    if (hillZone) {
      constrainArmFromHaulTruck(
        sim,
        vel,
        boomSwing,
        subBefore,
        hillZone.dropX,
        hillZone.dropZ,
        haulTruckPresent,
        getArmCollisionSamples,
      );
    }
  }
  if (constrainExcavatorToMap(sim, terrain)) {
    vel.travel = 0;
    vel.trackTurn = 0;
    vel.trackLeft = 0;
    vel.trackRight = 0;
  }
  // Height samples are cell-based. Dividing a cell-boundary height jump by the
  // tiny per-frame travel distance creates a false near-vertical slope and
  // repeatedly zeroes travel velocity. Probe across a full terrain cell instead.
  const slopeProbe = Math.max(terrain.cellSize, 1);
  const slopeX =
    Math.abs(
      sampleHeight(terrain, sim.posX + slopeProbe, sim.posZ) -
        sampleHeight(terrain, sim.posX - slopeProbe, sim.posZ),
    ) /
    (slopeProbe * 2);
  const slopeZ =
    Math.abs(
      sampleHeight(terrain, sim.posX, sim.posZ + slopeProbe) -
        sampleHeight(terrain, sim.posX, sim.posZ - slopeProbe),
    ) /
    (slopeProbe * 2);
  const terrainGrade = Math.hypot(slopeX, slopeZ);
  if (terrainGrade > 1.05) {
    sim.posX = beforeTravel.x;
    sim.posZ = beforeTravel.z;
    vel.travel = 0;
    vel.trackTurn = 0;
    vel.trackLeft = 0;
    vel.trackRight = 0;
  }
  const bodyGround = sampleHeight(terrain, sim.posX, sim.posZ);
  const baselinePosY = bodyGround - 0.72;
  let dozerSupportLift = 0;
  const bladeCommand = Math.max(0, Math.min(1, auxiliary?.blade ?? 0));
  if (bladeCommand > 0.01) {
    const bladeProbe = getDozerBladeContactWorld(sim, 0, dozerBladeReach);
    const asphaltTile = getCrashTileAt(terrain, bladeProbe.x, bladeProbe.z);
    if (asphaltTile?.active) {
      const asphaltSurface = sampleCrashContactHeight(
        terrain,
        bladeProbe.x,
        bladeProbe.z,
      );
      // posY에 이미 포함된 리프트와 무관하게, 지면 안착 높이 기준으로 필요 리프트를 계산한다.
      const savedPosY = sim.posY;
      sim.posY = baselinePosY;
      const maxBladeOnAsphalt = getMaxDozerBladeFromGround(
        sim,
        asphaltSurface,
        0.02,
        dozerBladeReach,
      );
      sim.posY = savedPosY;
      if (bladeCommand > maxBladeOnAsphalt) {
        dozerSupportLift =
          (bladeCommand - maxBladeOnAsphalt) * YANMAR_MACHINE_RIG.dozerBladeDrop;
      }
    }
  }
  const targetPosY = baselinePosY + dozerSupportLift;
  const verticalFollow = (targetPosY - sim.posY) * Math.min(1, dt * 18);
  // Cap both rise and drop so sharp pivots over height samples cannot fling the body.
  const maxStep = dt * 1.2;
  sim.posY += Math.max(-maxStep, Math.min(maxStep, verticalFollow));
  if (constrainExcavatorToDumpTruck(sim, beforeTravel, truckPose)) {
    vel.travel = 0;
    vel.trackTurn = 0;
    vel.trackLeft = 0;
    vel.trackRight = 0;
    constrainExcavatorToMap(sim, terrain);
  }
  if (constrainExcavatorToTruckTarget(sim, beforeTravel, haulAlignForCollision)) {
    vel.travel = 0;
    vel.trackTurn = 0;
    vel.trackLeft = 0;
    vel.trackRight = 0;
    constrainExcavatorToMap(sim, terrain);
  }

  let bucketContact = bucketClearance(sim, terrain, boomSwing, grappleOpen);
  let { clearance } = bucketContact;
  const bucketContactInDigZone = isInDigZone(
    bucketContact.tip.x,
    bucketContact.tip.z,
    terrain,
  );
  const breakerContact =
    sim.attachmentType === "breaker"
      ? sampleBreakerContactHeight(
          terrain,
          bucketContact.tip.x,
          bucketContact.tip.z,
          BREAKER_TIP_PROBE_RADIUS,
        )
      : null;
  const breakerOnAsphalt = !!breakerContact?.tile?.active;
  const minBucketClearance =
    sim.attachmentType === "grapple"
      ? MIN_GRAPPLE_GROUND_CLEARANCE
      : breakerOnAsphalt
        ? MIN_BREAKER_SURFACE_CLEARANCE
        : bucketContactInDigZone
          ? MIN_BUCKET_DIG_ZONE_CLEARANCE
          : MIN_BUCKET_GROUND_CLEARANCE;
  const wasAlreadyBelowGround =
    beforeControlBucket.clearance < minBucketClearance - 0.02;
  const worsenedGroundPenetration =
    clearance < beforeControlBucket.clearance - 0.002;
  const bucketOverDumpBed = isInDumpTruckBed(
    bucketContact.tip.x,
    bucketContact.tip.z,
    0.35,
    truckPose.groupX,
    truckPose.groupZ,
  );
  // 굴착지 소진으로 지면이 복구되어 버킷이 순간적으로 묻힌 경우,
  // 더 깊게 파고드는 조작만 막고 지면에서 빠져나오는 조작은 허용한다.
  // 짐칸 위에서는 지형 높이(트럭 아래) 기준으로 하역 버켓 개방이 막히지 않게 한다.
  if (
    !bucketOverDumpBed &&
    clearance < minBucketClearance - 0.02 &&
    (!wasAlreadyBelowGround || worsenedGroundPenetration)
  ) {
    sim.boom = beforeGroundContact.boom;
    sim.arm = beforeGroundContact.arm;
    sim.bucket = beforeGroundContact.bucket;
    if (vel.boom > 0) vel.boom = 0;
    if (vel.arm > 0) vel.arm = 0;
    if (vel.bucket > 0) vel.bucket = 0;
    bucketContact = bucketClearance(sim, terrain, boomSwing, grappleOpen);
    ({ clearance } = bucketContact);
  }
  if (isAutoArm) {
    advanceAutoArmPose(sim, vel, autoPose);
  }
  const scraper = getBucketScraperContactWorld(sim, boomSwing);
  const bucketTip = getBucketTipWorld(sim, boomSwing);
  const grappleClamp = getGrappleClampWorld(sim, boomSwing);
  if (sim.attachmentType === "grapple" && auxiliary) {
    const pedal = auxiliary.attachmentPedal;
    // 발판 유지 동안 개폐가 서서히 변하도록 (풀오픈 → 닫기 집기 모션)
    const openRate = 0.675;
    if (pedal > 0) {
      auxiliary.grappleOpen = Math.max(0, auxiliary.grappleOpen - openRate * dt);
    } else if (pedal < 0) {
      auxiliary.grappleOpen = Math.min(1, auxiliary.grappleOpen + openRate * dt);
    }
  }
  const grappleJawSamples =
    sim.attachmentType === "grapple"
      ? getGrappleJawSampleWorlds(sim, boomSwing, auxiliary?.grappleOpen ?? 1)
      : [];
  const toolTip =
    sim.attachmentType === "breaker"
      ? getBreakerTipWorld(sim, boomSwing)
      : sim.attachmentType === "grapple"
        ? grappleClamp
        : bucketTip;
  const breakerTipContact =
    sim.attachmentType === "breaker"
      ? sampleBreakerContactHeight(
          terrain,
          toolTip.x,
          toolTip.z,
          BREAKER_TIP_PROBE_RADIUS,
        )
      : null;
  const toolZoneRaw = getZoneAt(toolTip.x, toolTip.z, terrain);
  const toolZone =
    sim.attachmentType === "breaker" && breakerTipContact?.tile?.active
      ? "crash"
      : sim.attachmentType === "grapple" && toolZoneRaw !== "hill"
        ? getZoneAt(bucketTip.x, bucketTip.z, terrain) === "hill" ||
          getZoneAt(sim.posX, sim.posZ, terrain) === "hill"
          ? "hill"
          : toolZoneRaw
        : toolZoneRaw;
  const bedDeckY = dumpTruckBedDeckWorldY();
  const minDumpHeight = bedDeckY + DUMP_TRUCK.dumpMinHeightAboveDeck;
  const truckBedCenter = dumpTruckBedCenterWorld(truckPose.groupX, truckPose.groupZ);
  const bucketReachY = Math.max(scraper.y, bucketTip.y);
  const scraperGroundH = sampleHeight(terrain, scraper.x, scraper.z);
  const scraperDepthBelow = scraperGroundH - scraper.y;
  if (!systemsFrozen) {
    updateDigZoneRespawns(terrain);
  }
  const activeDigZones = getActiveDigZones(terrain);
  const scraperInDigZone = isInDigZone(scraper.x, scraper.z, terrain);
  const tipInDigZone = isInDigZone(bucketTip.x, bucketTip.z, terrain);
  const toolGround =
    sim.attachmentType === "breaker"
      ? (breakerTipContact?.height ??
        sampleCrashContactHeight(terrain, toolTip.x, toolTip.z))
      : sampleHeight(terrain, toolTip.x, toolTip.z);
  const toolTouchesGround =
    toolTip.y - toolGround <=
    (sim.attachmentType === "breaker" ? BREAKER_TOUCH_BAND : 0.12);
  const breakerGroundAngle =
    sim.attachmentType === "breaker"
      ? getBreakerGroundAngleDeg(sim, boomSwing)
      : 90;
  const breakerAngleReady =
    breakerGroundAngle >= MIN_BREAKER_GROUND_ANGLE_DEG;
  const warnAttachment = (message?: string, latchKey?: string) => {
    if (!message) return;
    if (latchKey) {
      // Show once while the invalid condition is held; clear when it ends.
      if (runtime.warningLatchKey === latchKey) return;
      runtime.warningLatchKey = latchKey;
      onAttachmentWarning(message);
      return;
    }
    if (runtime.warningCooldown > 0) return;
    runtime.warningCooldown = 3;
    onAttachmentWarning(message);
  };
  const clearWarningLatch = (latchKey: string) => {
    if (runtime.warningLatchKey === latchKey) {
      runtime.warningLatchKey = null;
    }
  };

  if (
    sim.attachmentType === "breaker" &&
    (auxiliary?.attachmentPedal ?? 0) !== 0
  ) {
    const permission = checkAttachmentUse("breaker", toolZone, "strike");
    if (!permission.allowed) {
      if (toolTouchesGround) {
        warnAttachment(permission.message, "breaker-zone");
      } else {
        clearWarningLatch("breaker-zone");
      }
    } else {
      clearWarningLatch("breaker-zone");
      if (toolTouchesGround && !breakerAngleReady) {
        warnAttachment("브레이커를 수직에 가깝게 세우세요.");
      } else if (toolTouchesGround && runtime.attachmentActionCooldown <= 0) {
        const tile = breakerTipContact?.tile ?? null;
        if (tile?.active) {
          runtime.breakerHitCount += 1;
          let hitDamage = rollYanmarBreakerDamage(stats.breakerDamage, {
            bonusOnly: true,
          });
          const every3 = stats.breakerEvery3HitMult ?? 1;
          if (every3 > 1 && runtime.breakerHitCount % 3 === 0) {
            hitDamage = Math.round(hitDamage * every3);
          }
          const result = damageCrashTile(terrain, tile.id, hitDamage);
          // Hold-to-hammer: rapid ticks while the foot pedal stays down.
          runtime.attachmentActionCooldown = 0.11;
          runtime.digDust.active = true;
          runtime.digDust.x = toolTip.x;
          runtime.digDust.y = toolGround + 0.08;
          runtime.digDust.z = toolTip.z;
          if (result) {
            fb.crashHitTick += 1;
            fb.crashHitDamage = hitDamage;
            if (result.destroyed) onCrashTileDestroyed(tile.id);
          }
        }
      }
    }
  } else {
    clearWarningLatch("breaker-zone");
  }

  const grapplePedal =
    sim.attachmentType === "grapple"
      ? (auxiliary?.attachmentPedal ?? 0)
      : 0;
  const angleReady = grappleBucketAngleReady(sim.bucket);
  const hillForGrapple = terrain.hillZone;
  const wrappableRock =
    sim.attachmentType === "grapple" &&
    hillForGrapple?.active &&
    !sim.carriedBoulderId
      ? findWrappableHillRock(
          hillForGrapple,
          grappleJawSamples,
          grappleClamp,
          terrain,
        )
      : null;

  if (sim.attachmentType === "grapple") {
    const permission = checkAttachmentUse("grapple", toolZone, "grab");
    const closing = grapplePedal > 0;
    const opening = grapplePedal < 0;
    const grappleOpenAmount = auxiliary?.grappleOpen ?? 1;
    /** 70% 이상 열린 상태에서 접기를 시작하면 닫히는 동안 집기 가능. */
    if (closing && grappleOpenAmount >= GRAPPLE_GRAB_MIN_OPEN) {
      runtime.grappleGrabArmed = true;
    } else if (!closing) {
      runtime.grappleGrabArmed = false;
    }
    const groundPickup =
      !!wrappableRock &&
      isGrappleGroundPickupPose(
        grappleClamp,
        wrappableRock,
        sampleHeight(terrain, wrappableRock.x, wrappableRock.z),
      );
    // Rocks only exist in the stone zone — allow wrap contact even if the clamp
    // samples just outside the painted radius after terrain flatten.
    const canGrabHere = permission.allowed || wrappableRock != null;

    if (grapplePedal !== 0 && !canGrabHere && toolTouchesGround) {
      warnAttachment(permission.message, "grapple-zone");
    } else {
      clearWarningLatch("grapple-zone");
    }

    if (canGrabHere && runtime.attachmentActionCooldown <= 0) {
      if (hillForGrapple?.active && !sim.carriedBoulderId && closing) {
        // 접힌 채 닫기·공중 집기 불가. 지면 자세 + (70%↑ 열린 뒤 접기)만 허용.
        if (wrappableRock && runtime.grappleGrabArmed && groundPickup) {
          if (!angleReady) {
            warnAttachment("버켓 각도를 집게와 맞춰주세요.");
            runtime.attachmentActionCooldown = 0.35;
          } else {
            wrappableRock.active = false;
            sim.carriedBoulderId = wrappableRock.id;
            runtime.grappleGrabArmed = false;
            resetGrappleGrip(runtime.grappleGrip);
            runtime.grappleGrip.contactElapsed = 0;
            runtime.grappleGrip.comFactor = computeComAlignFactor(
              wrappableRock,
              grappleClamp.x,
              grappleClamp.z,
            );
            const initial = computeGrappleAdhesion({
              rock: wrappableRock,
              contactElapsed: 0,
              bucketAngle: sim.bucket,
              comFactor: runtime.grappleGrip.comFactor,
              adhesionBonus: stats.gripAdhesionBonus,
            });
            runtime.grappleGrip.adhesion01 = initial.adhesion01;
            runtime.grappleGrip.pressure01 = initial.pressure01;
            runtime.attachmentActionCooldown = 0.2;
          }
        }
      } else if (hillForGrapple && sim.carriedBoulderId && opening) {
        const atDrop = isAlignedForTruckDump(
          sim.posX,
          sim.posZ,
          sim.heading,
          sim.swing,
          getHaulTruckAlignTarget(
            hillForGrapple.dropX,
            hillForGrapple.dropZ,
            hillForGrapple.haulTruck.phase === "ready",
          ),
        );
        const rock = hillForGrapple.boulders.find(
          (item) => item.id === sim.carriedBoulderId,
        );
        if (
          atDrop &&
          runtime.grappleGrip.liftChecked &&
          addHaulTruckRock(terrain, stats.haulTruckCapacity)
        ) {
          if (rock) {
            rock.delivered = true;
            rock.extracted = true;
            rock.active = false;
          }
          const deliveredId = sim.carriedBoulderId;
          sim.carriedBoulderId = null;
          resetGrappleGrip(runtime.grappleGrip);
          runtime.attachmentActionCooldown = 0.6;
          tryClearHillZone(terrain);
          onHillRockDelivered(deliveredId);
        } else if (atDrop && !runtime.grappleGrip.liftChecked) {
          warnAttachment("붐을 들어 적재 판정을 완료하세요.");
          runtime.attachmentActionCooldown = 0.45;
        } else if (!atDrop && rock) {
          placeCarriedRockOnGround(rock, grappleClamp, terrain);
          sim.carriedBoulderId = null;
          resetGrappleGrip(runtime.grappleGrip);
          runtime.attachmentActionCooldown = 0.35;
        }
      }
    }

    // 운반 중 닫기 유지: 압력·밀착감 갱신
    // - 압력 최대(또는 페달 해제) 시 밀착 확정 → 이후 붐을 들어 적재 판정
    // - 닫기 유지 중에도 밀착이 풀리지 않게 해, 발판을 밟은 채 붐을 들어도 판정됨
    if (sim.carriedBoulderId && hillForGrapple) {
      const carried = hillForGrapple.boulders.find(
        (item) => item.id === sim.carriedBoulderId,
      );
      const g = runtime.grappleGrip;
      if (carried && closing && !g.liftChecked) {
        if (!g.locked) {
          g.contactElapsed += dt;
          if (
            Math.hypot(grappleClamp.x - carried.x, grappleClamp.z - carried.z) <=
            hillBoulderWrapRadius(carried) * 1.8
          ) {
            g.comFactor = computeComAlignFactor(
              carried,
              grappleClamp.x,
              grappleClamp.z,
            );
          }
          const next = computeGrappleAdhesion({
            rock: carried,
            contactElapsed: g.contactElapsed,
            bucketAngle: sim.bucket,
            comFactor: g.comFactor,
            adhesionBonus: stats.gripAdhesionBonus,
          });
          g.adhesion01 = next.adhesion01;
          g.pressure01 = next.pressure01;
          // 압력 최대면 페달을 유지해도 밀착 확정 (붐 상승·적재 판정 가능)
          if (g.pressure01 >= 1) {
            g.locked = true;
            g.clearanceAtLock =
              grappleClamp.y -
              sampleHeight(terrain, grappleClamp.x, grappleClamp.z);
          }
        }
      } else if (carried && !closing && !opening && !g.locked && !g.liftChecked) {
        g.locked = true;
        g.clearanceAtLock =
          grappleClamp.y - sampleHeight(terrain, grappleClamp.x, grappleClamp.z);
      }
    } else if (!sim.carriedBoulderId && !runtime.grappleGrip.liftResult) {
      if (runtime.grappleGrip.contactElapsed > 0 && !runtime.grappleGrip.liftChecked) {
        resetGrappleGrip(runtime.grappleGrip);
      }
    }
  } else {
    clearWarningLatch("grapple-zone");
  }

  // 밀착 확정 후, 붐을 들어 클램프가 충분히 올라갔을 때만 성공/실패 판정
  {
    const grip = runtime.grappleGrip;
    const carryGround = sampleHeight(terrain, grappleClamp.x, grappleClamp.z);
    const carryClearance = grappleClamp.y - carryGround;
    const liftNeeded =
      (grip.clearanceAtLock ?? 0) + GRAPPLE_LIFT_JUDGE_CLEARANCE_DELTA;
    const liftedEnough =
      carryClearance >= GRAPPLE_TRAVEL_LOCK_CLEARANCE &&
      carryClearance >= liftNeeded;
    if (
      sim.attachmentType === "grapple" &&
      sim.carriedBoulderId &&
      grip.locked &&
      !grip.liftChecked &&
      liftedEnough
    ) {
      const success = Math.random() < grip.adhesion01;
      grip.liftChecked = true;
      grip.liftResult = success ? "success" : "fail";
      grip.liftResultTick += 1;
      if (success) {
        onAttachmentWarning("적재 성공");
      } else {
        const rock = terrain.hillZone?.boulders.find(
          (item) => item.id === sim.carriedBoulderId,
        );
        const safeLoad = Math.random() < stats.hillSafeLoadChance;
        if (rock && safeLoad) {
          placeCarriedRockOnGround(rock, grappleClamp, terrain);
          sim.carriedBoulderId = null;
          runtime.digDust.active = true;
          runtime.digDust.x = grappleClamp.x;
          runtime.digDust.y = grappleClamp.y;
          runtime.digDust.z = grappleClamp.z;
          const failTick = grip.liftResultTick;
          resetGrappleGrip(grip);
          grip.liftResult = "fail";
          grip.liftResultTick = failTick;
          onAttachmentWarning("돌이 깨지지 않아 다시 적재할 수 있습니다.");
        } else {
          if (rock) {
            destroyCarriedRock(rock);
            tryClearHillZone(terrain);
          }
          sim.carriedBoulderId = null;
          runtime.digDust.active = true;
          runtime.digDust.x = grappleClamp.x;
          runtime.digDust.y = grappleClamp.y;
          runtime.digDust.z = grappleClamp.z;
          const failTick = grip.liftResultTick;
          resetGrappleGrip(grip);
          grip.liftResult = "fail";
          grip.liftResultTick = failTick;
          onAttachmentWarning("낙하하여 돌이 쓸수없게 되었습니다.");
        }
      }
    }
  }

  // 집어서 돌 구역 밖으로 나가면 반출 처리. 전부 반출되면 구역이 사라진다.
  if (terrain.hillZone?.active && sim.carriedBoulderId) {
    if (!isInsideHillZoneCore(terrain.hillZone, sim.posX, sim.posZ)) {
      markHillRockExtracted(terrain, sim.carriedBoulderId);
      sim.carriedBoulderId = null;
      resetGrappleGrip(runtime.grappleGrip);
    }
  }
  const isInDumpTruckRearBox = (wx: number, wz: number) => {
    const local = worldToDumpTruckLocal(wx, wz, truckPose.groupX, truckPose.groupZ);
    const relX = local.x - DUMP_TRUCK.bedLocalX;
    const relZ = local.z - DUMP_TRUCK.bedLocalZ;
    const visualBoxMargin = 0.3;
    const halfW = DUMP_TRUCK.bedWidth / 2 + visualBoxMargin;
    const halfD = DUMP_TRUCK.bedDepth / 2 + visualBoxMargin;
    return Math.abs(relX) <= halfW && Math.abs(relZ) <= halfD;
  };
  const bucketMouthCenter = {
    x: (scraper.x + bucketTip.x) / 2,
    z: (scraper.z + bucketTip.z) / 2,
  };
  const bucketOverTruck = isInDumpTruckRearBox(
    bucketMouthCenter.x,
    bucketMouthCenter.z,
  );
  const dumpAlignTarget = getDumpTruckAlignTarget(
    truckPose.groupX,
    truckPose.groupZ,
    truckPose.present,
  );
  const dumpBodyTouching = dumpAlignTarget
    ? isBodyTouchingTruck(sim.posX, sim.posZ, dumpAlignTarget)
    : false;
  const dumpFacingBed = dumpAlignTarget
    ? isFacingTruckBedCenter(
        sim.posX,
        sim.posZ,
        sim.heading,
        sim.swing,
        dumpAlignTarget.bedCenterX,
        dumpAlignTarget.bedCenterZ,
      )
    : false;
  const alignedForDumpTruck = isAlignedForTruckDump(
    sim.posX,
    sim.posZ,
    sim.heading,
    sim.swing,
    dumpAlignTarget,
  );
  const haulAlignTarget = haulAlignForCollision;
  const haulBodyTouching = haulAlignTarget
    ? isBodyTouchingTruck(sim.posX, sim.posZ, haulAlignTarget)
    : false;
  // 방향만 맞으면 맵 전역에서 true가 되므로, 안내·정렬은 트럭 근처에서만 본다.
  const HAUL_GUIDE_RADIUS = 8;
  const haulNearForGuide =
    !!haulAlignTarget &&
    Math.hypot(
      sim.posX - haulAlignTarget.groupX,
      sim.posZ - haulAlignTarget.groupZ,
    ) <= HAUL_GUIDE_RADIUS;
  const haulFacingBed =
    haulAlignTarget && haulNearForGuide
      ? isFacingTruckBedCenter(
          sim.posX,
          sim.posZ,
          sim.heading,
          sim.swing,
          haulAlignTarget.bedCenterX,
          haulAlignTarget.bedCenterZ,
        )
      : false;
  const alignedForHaulTruck = isAlignedForTruckDump(
    sim.posX,
    sim.posZ,
    sim.heading,
    sim.swing,
    haulAlignTarget,
  );
  const bucketNearDumpTarget =
    Math.hypot(bucketMouthCenter.x - truckBedCenter.x, bucketMouthCenter.z - truckBedCenter.z) <=
    DUMP_ZONE.radius + 1.2;
  const bodyInDumpZone = isInDumpZone(sim.posX, sim.posZ);
  const bucketOpening = sim.bucket > 1.1;
  const bucketAboveBed = bucketReachY >= minDumpHeight;
  const bodyNearDigZone = activeDigZones.some(
    (zone) =>
      Math.hypot(sim.posX - zone.x, sim.posZ - zone.z) <
      zone.radius + 9 * Math.max(1, stats.reachMultiplier ?? 1),
  );
  const inZone = scraperInDigZone || tipInDigZone || bodyNearDigZone;
  const bucketContactsInDump =
    isInDumpZone(scraper.x, scraper.z) || isInDumpZone(bucketTip.x, bucketTip.z);
  const bucketReadyOverTruck = bucketNearDumpTarget && (bucketAboveBed || bucketOpening);
  const inDump =
    bodyInDumpZone ||
    bucketContactsInDump ||
    bucketOverTruck ||
    bucketReadyOverTruck ||
    alignedForDumpTruck;
  // 흙트럭·돌트럭 공통: 차체 밀착 + 정면이 짐칸 중심
  const inTruckDumpTarget = alignedForDumpTruck;
  if (!inDump && truckState.fillUnits >= stats.truckCapacityUnits - 0.5) {
    if (truckState.phase === "ready") {
      beginDumpTruckDeparture(truckState);
      onDumpTruckFull?.();
    }
  }
  const haulTruckDropZone = terrain.hillZone;
  if (
    haulTruckDropZone &&
    !alignedForHaulTruck &&
    haulTruckDropZone.haulTruck.loadCount >=
      Math.max(1, Math.floor(stats.haulTruckCapacity))
  ) {
    if (haulTruckDropZone.haulTruck.phase === "ready") {
      beginHaulTruckDeparture(terrain, stats.haulTruckCapacity);
      onHaulTruckFull?.();
    }
  }
  const reach = Math.max(1, stats.reachMultiplier ?? 1);
  const bucketInWorkRange =
    scraperDepthBelow > -1.4 * reach && scraperDepthBelow < 2.6 * reach;
  const tipOnGround =
    scraperDepthBelow > -1.2 * reach && scraperDepthBelow < 2.6 * reach;
  const curled = isBucketCurled(sim.boom, sim.bucket);
  const soilRetention = getBucketSoilRetention(sim.boom, sim.arm, sim.bucket);
  const bucketOpenReady = sim.bucket >= 0.35 && sim.bucket <= 1.85;
  const insertedDeepEnough = scraperDepthBelow >= -0.15 && scraperDepthBelow <= 2.75;
  const autoSaved = isAutoArm ? autoPose.saved : null;
  const autoActiveJoint = isAutoArm ? getActiveAutoPoseJoint(autoPose) : null;
  const bucketCurlingInward =
    filtered.right.x < -0.08 ||
    (autoActiveJoint === "bucket" && autoSaved != null);
  const bucketCurlReady =
    (bucketCurlingInward && sim.bucket <= 1.85) ||
    (autoActiveJoint === "bucket" && autoSaved != null && sim.bucket <= 1.85);
  // left.y < 0 / vel.arm < 0 = 암 당김(각도↓) — applyControls 매핑과 동일
  const armPulling =
    filtered.left.y < -0.05 ||
    vel.arm < -0.025 ||
    autoActiveJoint === "arm";
  const naturalDigPose =
    inZone &&
    bucketInWorkRange &&
    bucketOpenReady &&
    insertedDeepEnough &&
    bucketCurlReady;
  const manualDigPoseScore =
    (bucketOpenReady ? 1 : 0) +
    (insertedDeepEnough ? 1 : 0) +
    (bucketCurlReady ? 1 : 0) +
    (armPulling ? 1 : 0);
  const autoDigPoseScore =
    autoSaved == null
      ? 0
      : getAutoDigPoseReadiness(sim, autoPose, insertedDeepEnough, bucketOpenReady);
  const poseReadiness = isAutoArm
    ? Math.max(manualDigPoseScore / 4, autoDigPoseScore)
    : manualDigPoseScore / 4;
  // Position-ready for dig loading (marker); actual fill still needs curling motion.
  const loadCap = mode === "tutorial" ? 1 : 0.98;
  const canLoad =
    sim.attachmentType === "bucket" &&
    inZone &&
    bucketInWorkRange &&
    sim.bucketLoad < loadCap &&
    soilRetention >= BUCKET_SOIL_HOLD_MIN &&
    (poseReadiness >= 0.5 || (isAutoArm && autoDigPoseScore >= 0.25));

  const crashTileAtTip = breakerTipContact?.tile ?? null;
  const breakerOverAsphalt =
    sim.attachmentType === "breaker" && !!crashTileAtTip?.active;
  const breakerNeedsVertical =
    breakerOverAsphalt && toolTouchesGround && !breakerAngleReady;
  const canStrike =
    breakerOverAsphalt && toolTouchesGround && breakerAngleReady;

  const grappleOpenForHud = auxiliary?.grappleOpen ?? 1;
  const grappleGroundPickupHud =
    !!wrappableRock &&
    isGrappleGroundPickupPose(
      grappleClamp,
      wrappableRock,
      sampleHeight(terrain, wrappableRock.x, wrappableRock.z),
    );
  const grappleReadyToCloseGrab =
    grappleOpenForHud >= GRAPPLE_GRAB_MIN_OPEN || runtime.grappleGrabArmed;
  const canGrab =
    sim.attachmentType === "grapple" &&
    !sim.carriedBoulderId &&
    !!wrappableRock &&
    angleReady &&
    grappleGroundPickupHud &&
    grappleReadyToCloseGrab;
  const grappleNeedsAlignment =
    sim.attachmentType === "grapple" &&
    !sim.carriedBoulderId &&
    !!wrappableRock &&
    grappleGroundPickupHud &&
    grappleReadyToCloseGrab &&
    !angleReady;
  const canDropRock =
    sim.attachmentType === "grapple" &&
    !!sim.carriedBoulderId &&
    runtime.grappleGrip.liftChecked &&
    alignedForHaulTruck;
  const showGripGauge =
    sim.attachmentType === "grapple" &&
    !!sim.carriedBoulderId &&
    !runtime.grappleGrip.liftChecked;
  const gripState = runtime.grappleGrip;

  const digZoneAt =
    getActiveDigZoneAt(terrain, scraper.x, scraper.z) ??
    getActiveDigZoneAt(terrain, bucketTip.x, bucketTip.z) ??
    (bodyNearDigZone
      ? [...activeDigZones].sort(
          (a, b) =>
            Math.hypot(sim.posX - a.x, sim.posZ - a.z) -
            Math.hypot(sim.posX - b.x, sim.posZ - b.z),
        )[0] ?? null
      : null);

  fb.inDigZone = inZone;
  fb.inDumpZone = inDump;
  fb.tipOnGround = tipOnGround;
  fb.bucketCurled = curled;
  fb.canLoad = canLoad;
  fb.digZoneRemainingUnits = digZoneAt?.remainingUnits ?? 0;
  fb.canStrike = canStrike;
  fb.breakerNeedsVertical = breakerNeedsVertical;
  fb.canGrab = canGrab;
  fb.grappleNeedsAlignment = grappleNeedsAlignment;
  fb.canDropRock = canDropRock;
  fb.showGripGauge = showGripGauge;
  fb.gripAdhesion = gripState.adhesion01;
  fb.gripPressure = gripState.pressure01;
  fb.grappleLiftResult = gripState.liftResult;
  fb.grappleLiftResultTick = gripState.liftResultTick;
  if (crashTileAtTip?.active) {
    fb.crashTileHp = crashTileAtTip.hp;
    fb.crashTileMaxHp = crashTileAtTip.maxHp;
  } else {
    fb.crashTileHp = 0;
    fb.crashTileMaxHp = 0;
  }
  fb.groundDepth = scraperDepthBelow;
  fb.digging = false;
  fb.bladeWorking = false;
  fb.bucketOpenReady = bucketOpenReady;
  fb.insertedDeepEnough = insertedDeepEnough;
  fb.bucketCurlReady = bucketCurlReady;
  fb.armPulling = armPulling;
  fb.optimalDigPose = naturalDigPose;
  fb.digPoseScore = poseReadiness;
  fb.soilRetention = soilRetention;
  fb.soilSpilling = false;
  const truckCanAccept = canDumpTruckAcceptDump(truckState, stats.truckCapacityUnits);
  const truckFillRatio = getDumpTruckFillRatio(truckState, stats.truckCapacityUnits);
  const haulCapacity = Math.max(1, Math.floor(stats.haulTruckCapacity));
  const haulTruck = terrain.hillZone?.haulTruck ?? null;
  fb.truckPresent = isDumpTruckVisible(truckState);
  fb.haulTruckPresent = haulTruckPresent;
  fb.nearHaulTruck = haulNearForGuide;
  fb.carryingRock = !!sim.carriedBoulderId;
  fb.truckCanAccept = truckCanAccept;
  fb.truckFillRatio = truckFillRatio;
  fb.truckCooldownRemaining = getDumpTruckReturnEtaSec(truckState, stats.truckCooldownSec);
  fb.haulTruckCanAccept = canHaulTruckAcceptRock(haulTruck, haulCapacity);
  fb.haulTruckFillRatio = getHaulTruckFillRatio(haulTruck, haulCapacity);
  fb.haulTruckCooldownRemaining = getHaulTruckReturnEtaSec(
    haulTruck,
    stats.haulTruckCooldownSec,
  );
  fb.haulTruckLoadCount = haulTruck?.loadCount ?? 0;
  fb.haulTruckCapacity = haulCapacity;
  fb.digCooldowns = terrain.dynamicDigZones
    ? terrain.digZones
        .map((zone, index) => ({
          id: zone.id,
          label: digZoneLabel(zone.id, index),
          etaSec: getDigZoneRespawnEtaSec(zone),
        }))
        .filter((zone) => zone.etaSec > 0)
    : [];
  fb.crashCooldownEtaSec = getCrashZoneRespawnEtaSec(terrain.crashZone);
  fb.hillCooldownEtaSec = getHillZoneRespawnEtaSec(terrain.hillZone);
  fb.canDump = inTruckDumpTarget && sim.bucketLoad > 0.02 && truckCanAccept;
  fb.dumpBodyTouching =
    sim.attachmentType === "grapple" ? haulBodyTouching : dumpBodyTouching;
  fb.dumpFacingBed =
    sim.attachmentType === "grapple" ? haulFacingBed : dumpFacingBed;
  fb.raiseArmForDump =
    inDump &&
    sim.bucketLoad > 0.02 &&
    dumpBodyTouching &&
    dumpFacingBed &&
    !bucketAboveBed &&
    !bucketOpening;
  fb.travelBlockedRaiseArm = toolBlocksTravel && wantsTravel;

  const isGame = mode === "game";
  const isTutorial = mode === "tutorial";
  const digRate = isTutorial ? 9.5 : 7.2;
  const loadRate = isTutorial ? 7.0 : 5.4;

  const bucketDigInput =
    Math.max(0, -filtered.right.x) > 0.12 ||
    Math.max(0, -filtered.left.y) > 0.12;
  if (
    sim.attachmentType === "bucket" &&
    bucketDigInput &&
    toolTouchesGround &&
    !inZone
  ) {
    const permission = checkAttachmentUse("bucket", toolZone, "dig");
    warnAttachment(permission.message, "bucket-dig-zone");
  } else {
    clearWarningLatch("bucket-dig-zone");
  }

  if (
    sim.attachmentType === "bucket" &&
    (scraperInDigZone || tipInDigZone) &&
    bucketInWorkRange &&
    sim.bucketLoad < 1 &&
    soilRetention >= BUCKET_SOIL_HOLD_MIN
  ) {
    const scrape = Math.max(0.38, scraperDepthBelow + 0.9);
    const digX = scraperInDigZone ? scraper.x : tipInDigZone ? bucketTip.x : scraper.x;
    const digZ = scraperInDigZone ? scraper.z : tipInDigZone ? bucketTip.z : scraper.z;
    const inwardBucketMotion = Math.max(0, -vel.bucket);
    const pullArmMotion = Math.max(0, -vel.arm);
    const scrapeMotion =
      pullArmMotion * 0.8 +
      Math.abs(vel.travel) * 0.22 +
      inwardBucketMotion * 0.48 +
      Math.abs(vel.boom) * 0.25;
    const inputMotion =
      Math.max(0, -filtered.left.y) * 0.75 +
      Math.abs(filtered.right.y) * 0.3 +
      Math.max(0, -filtered.right.x) * 0.42;
    const autoDigLoadingActive =
      isAutoArm &&
      autoSaved != null &&
      isAutoPoseDigLoadingActive(sim, autoPose, {
        inZone,
        bucketInWorkRange,
        scrapeMotion,
      });
    const activelyScraping =
      (bucketCurlingInward &&
        (scrapeMotion > 0.015 || inputMotion > 0.05 || naturalDigPose)) ||
      autoDigLoadingActive;
    const naturalLoadReady =
      (inZone && bucketInWorkRange && poseReadiness >= 0.5 && bucketCurlingInward) ||
      (autoDigLoadingActive && autoDigPoseScore >= 0.25);
    const dug =
      naturalLoadReady && activelyScraping
        ? digAt(
            terrain,
            digX,
            digZ,
            (naturalDigPose ? 2.6 : 2.2) * reach,
            scrape * dt * digRate * (naturalDigPose ? 0.72 : 0.58),
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
      // 자세가 담을 수 있는 양까지만 적재 (열린/뒤집힌 버킷에 흙이 쌓이지 않음)
      const prevLoad = sim.bucketLoad;
      sim.bucketLoad = Math.min(1, soilRetention, sim.bucketLoad + loadDelta);
      const gainedUnits = (sim.bucketLoad - prevLoad) * stats.maxLoadUnits;
      if (gainedUnits > 0) {
        consumeDigZoneUnits(terrain, digX, digZ, gainedUnits);
        fb.digZoneRemainingUnits =
          getActiveDigZoneAt(terrain, digX, digZ)?.remainingUnits ?? 0;
      }
    }

    if (fb.digging) {
      runtime.digDust.active = true;
      runtime.digDust.x = digX;
      runtime.digDust.y = scraperGroundH + 0.08;
      runtime.digDust.z = digZ;
    } else {
      runtime.digDust.active = false;
    }
  } else {
    runtime.digDust.active = false;
  }

  // 트럭 하역이 아니어도, 유지 가능량보다 많으면 자세 때문에 흙이 쏟아짐
  const dumpParams = {
    isGame,
    score,
    stats,
    truckState,
    truckPose,
    tutorialDump,
    runtime,
    bedDeckY,
    bucketReachY,
    mouth: bucketMouthCenter,
    onProgress,
    onDumpScore,
  };
  if (
    sim.attachmentType === "bucket" &&
    sim.bucketLoad > soilRetention + 0.002 &&
    !(inTruckDumpTarget && !truckCanAccept)
  ) {
    const excess = sim.bucketLoad - soilRetention;
    const spillRate = soilRetention < BUCKET_SOIL_HOLD_MIN ? 2.4 : 1.35;
    const spillAmount =
      excess < 0.02 ? excess : Math.min(excess, Math.max(excess * spillRate * dt, 0.35 * dt));
    sim.bucketLoad = Math.max(0, sim.bucketLoad - spillAmount);
    fb.soilSpilling = spillAmount > 0.001;

    if (fb.soilSpilling && inTruckDumpTarget && truckCanAccept) {
      applyTruckDump(spillAmount, dumpParams);
    } else if (fb.soilSpilling) {
      runtime.dumpSoilVisual.active = true;
      runtime.dumpSoilVisual.intensity = Math.min(
        1.2,
        runtime.dumpSoilVisual.intensity + spillAmount * 5.2,
      );
      runtime.dumpSoilVisual.spawnX = bucketMouthCenter.x;
      runtime.dumpSoilVisual.spawnY = Math.max(bucketReachY - 0.15, scraper.y);
      runtime.dumpSoilVisual.spawnZ = bucketMouthCenter.z;
    }
  }

  // 하역 자세(버킷 펴기)면 장소와 무관하게 흙이 쏟아짐 — 트럭 위만 점수 반영
  // 단, 트럭이 보이지만 아직 하역 불가(복귀 중·만차)면 흙을 버리지 않는다.
  const bucketDumpOpen = sim.bucket > 1.35;
  if (
    sim.attachmentType === "bucket" &&
    sim.bucketLoad > 0.02 &&
    bucketDumpOpen &&
    !inTruckDumpTarget
  ) {
    const permission = checkAttachmentUse(
      "bucket",
      getZoneAt(bucketMouthCenter.x, bucketMouthCenter.z, terrain),
      "dump",
    );
    warnAttachment(permission.message, "bucket-dump-zone");
  } else {
    clearWarningLatch("bucket-dump-zone");
  }
  if (
    sim.attachmentType === "bucket" &&
    sim.bucketLoad > 0 &&
    bucketDumpOpen
  ) {
    if (inTruckDumpTarget && !truckCanAccept) {
      // 복귀 중/만차 트럭 위에 버킷을 펴도 적재를 소모하지 않음
    } else {
      const spillRate = 1.65;
      const remainingLoad = sim.bucketLoad;
      const dumpAmount =
        remainingLoad < 0.025
          ? remainingLoad
          : Math.min(remainingLoad, remainingLoad * spillRate * dt);
      sim.bucketLoad = Math.max(0, sim.bucketLoad - dumpAmount);
      fb.soilSpilling = dumpAmount > 0.001;

      if (inTruckDumpTarget && truckCanAccept) {
        applyTruckDump(dumpAmount, dumpParams);
      } else if (dumpAmount > 0.001) {
        runtime.dumpSoilVisual.active = true;
        runtime.dumpSoilVisual.intensity = Math.min(
          1.2,
          runtime.dumpSoilVisual.intensity + dumpAmount * 5.2,
        );
        runtime.dumpSoilVisual.spawnX = bucketMouthCenter.x;
        runtime.dumpSoilVisual.spawnY = Math.max(bucketReachY - 0.15, scraper.y);
        runtime.dumpSoilVisual.spawnZ = bucketMouthCenter.z;
      }
    }
  }

  runtime.dumpSoilVisual.intensity = Math.max(0, runtime.dumpSoilVisual.intensity - dt * 2.8);
  if (runtime.dumpSoilVisual.intensity <= 0.02) {
    runtime.dumpSoilVisual.active = false;
  }

  const bladeAmount = auxiliary?.blade ?? 0;
  const bladeGroundProbe = getDozerBladeContactWorld(
    sim,
    Math.min(1, Math.max(0, bladeAmount)),
    dozerBladeReach,
  );
  const bladeOnAsphalt = !!getCrashTileAt(
    terrain,
    bladeGroundProbe.x,
    bladeGroundProbe.z,
  )?.active;
  const bladeGroundY = bladeOnAsphalt
    ? sampleCrashContactHeight(terrain, bladeGroundProbe.x, bladeGroundProbe.z)
    : sampleHeight(terrain, bladeGroundProbe.x, bladeGroundProbe.z);
  // 아스팔트: 표면에 막힘. 흙밭: 절반쯤 파고들 수 있게 여유를 둔다.
  const bladeClearanceLimit = bladeOnAsphalt
    ? 0.02
    : isInDigZone(bladeGroundProbe.x, bladeGroundProbe.z, terrain)
      ? -0.28
      : 0.02;
  const effectiveBlade = Math.min(
    bladeAmount,
    getMaxDozerBladeFromGround(sim, bladeGroundY, bladeClearanceLimit, dozerBladeReach),
  );
  const bladeContact = getDozerBladeContactWorld(sim, effectiveBlade, dozerBladeReach);
  const bladeClearance = bladeContact.y - bladeGroundY;
  const forwardTravel = Math.max(0, vel.travel);
  const bladeInSoilField = isInDigZone(bladeContact.x, bladeContact.z, terrain);
  const bladeScraping =
    effectiveBlade > 0.55 &&
    bladeClearance < 0.12 &&
    forwardTravel > 0.35 &&
    bladeInSoilField;
  if (bladeScraping) {
    const bladeEff = Math.max(0.5, stats.bladeEfficiency ?? 1);
    digAt(
      terrain,
      bladeContact.x,
      bladeContact.z,
      2.1 * Math.max(1, stats.reachMultiplier ?? 1),
      forwardTravel * dt * 0.85 * bladeEff,
    );
    fb.bladeWorking = true;
    runtime.bladeSpray.active = true;
    runtime.bladeSpray.intensity = Math.min(
      1.35,
      runtime.bladeSpray.intensity + forwardTravel * dt * 1.8 * bladeEff,
    );
    runtime.bladeSpray.x = bladeContact.x;
    runtime.bladeSpray.y = bladeGroundY + 0.06;
    runtime.bladeSpray.z = bladeContact.z;
    runtime.bladeSpray.heading = sim.heading + sim.swing;
  } else {
    runtime.bladeSpray.intensity = Math.max(0, runtime.bladeSpray.intensity - dt * 3.2);
    if (runtime.bladeSpray.intensity <= 0.03) {
      runtime.bladeSpray.active = false;
    }
  }

  const worldPickups = params.worldPickups;
  if (worldPickups && mode === "game" && !systemsFrozen) {
    const pickupNow = Date.now();
    tickWorldPickups(worldPickups, terrain, pickupNow);
    const collected = tryCollectWorldPickup(
      worldPickups,
      sim.posX,
      sim.posZ,
      pickupNow,
    );
    if (collected) {
      params.onWorldPickup?.(collected);
    }
  }

  onSimTick();
}
