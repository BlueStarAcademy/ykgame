import type { AuxiliaryControlState, ControlMask, ExcavatorControlState, HydraulicVelocity } from "./controls";
import {
  applyControls,
  buildAutoArmControlInput,
  cancelAutoArmPose,
  finishAutoArmPoseIfComplete,
  getActiveAutoPoseJoint,
  getAutoDigPoseReadiness,
  hasManualControlInput,
  isAutoPoseDigLoadingActive,
  CONTROL_SPEED,
  RIDE_CONTROL_SPEED,
  canLoadBucket as isBucketCurled,
  filterInput,
} from "./controls";
import type { AutoPoseState } from "./types";
import {
  digAt,
  getActiveDigZones,
  isInDigZone,
  isInDumpZone,
  clampToDumpTruckBed,
  dumpTruckBedCenterWorld,
  dumpTruckBedDeckWorldY,
  getMapWorldBounds,
  sampleHeight,
  updateDigZoneRespawns,
  worldToDumpTruckLocal,
  type TerrainData,
  DUMP_ZONE,
  DUMP_TRUCK,
  DUMP_TRUCK_BED,
} from "./terrain";
import {
  getBucketBodyContactWorld,
  getBucketScraperContactWorld,
  getBucketTipWorld,
  type DigFeedback,
} from "./bucket";
import { constrainArmFromDumpTruck, isDumpTruckArmCollisionActive } from "./dumpTruckCollision";
import {
  addDumpTruckLoad,
  canDumpTruckAcceptDump,
  getDumpTruckFillRatio,
  getDumpTruckPose,
  getDumpTruckReturnEtaSec,
  isDumpTruckVisible,
  type DumpTruckPose,
  type DumpTruckRuntimeState,
  updateDumpTruckState,
} from "./dumpTruckState";
import type { DiggingScoreState } from "./scoring";
import type { GameMode } from "./tutorial";
import { calculateYanmarChunkScore, type YanmarEquipmentStats } from "./equipment";
import type { DumpScorePopup, ExcavatorSimState } from "./types";
import {
  DUMP_TRUCK_COLLIDER,
  EXCAVATOR_COLLISION_RADIUS,
  EXCAVATOR_MAP_WALL_MARGIN,
  MIN_BUCKET_DIG_ZONE_CLEARANCE,
  MIN_BUCKET_GROUND_CLEARANCE,
} from "./simConstants";

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

export interface SimLoopRuntime {
  lastReportedProgress: number;
  dumpScoreRemainder: number;
  dumpSoilVisual: DumpSoilVisual;
  digDust: DigDustVisual;
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
  onSimTick: () => void;
}

function clampControl(value: number, min = -1, max = 1) {
  return Math.max(min, Math.min(max, value));
}

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

function isExcavatorCollidingWithDumpTruck(x: number, z: number, pose?: DumpTruckPose) {
  if (pose && !pose.present) return false;
  const local = worldToDumpTruckLocal(x, z, pose?.groupX, pose?.groupZ);
  const localX = local.x - DUMP_TRUCK_COLLIDER.centerOffsetX;
  const localZ = local.z - DUMP_TRUCK_COLLIDER.centerOffsetZ;
  const outsideX = Math.max(Math.abs(localX) - DUMP_TRUCK_COLLIDER.halfX, 0);
  const outsideZ = Math.max(Math.abs(localZ) - DUMP_TRUCK_COLLIDER.halfZ, 0);
  return outsideX * outsideX + outsideZ * outsideZ <= EXCAVATOR_COLLISION_RADIUS ** 2;
}

function constrainExcavatorToDumpTruck(
  sim: ExcavatorSimState,
  previous: { x: number; z: number },
  pose?: DumpTruckPose,
) {
  if (!isExcavatorCollidingWithDumpTruck(sim.posX, sim.posZ, pose)) return false;
  sim.posX = previous.x;
  sim.posZ = previous.z;
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
    onSimTick,
  } = params;

  updateDumpTruckState(truckState, dt, stats.truckCooldownSec);
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
  const hydraulicSpeedScale = isRide
    ? auxiliary?.highSpeed
      ? 1.15
      : 1
    : auxiliary?.highSpeed
      ? 0.5
      : 0.25;
  const speedProfile = isRide ? RIDE_CONTROL_SPEED : CONTROL_SPEED;
  const travelSpeedScale = isRide ? 1 : stats.travelSpeedMultiplier;
  const boomSwing = auxiliary?.boomSwing ?? 0;
  const beforeControlBucket = bucketClearance(sim, terrain, boomSwing);
  const bucketTipInDigZone = isInDigZone(
    beforeControlBucket.tip.x,
    beforeControlBucket.tip.z,
    terrain,
  );
  const bucketAnchoredToGround =
    bucketTipInDigZone && beforeControlBucket.clearance < 0.18;
  const wantsTravel =
    allowed.travel &&
    (Math.abs(rawInput.travel.left) > 0.08 || Math.abs(rawInput.travel.right) > 0.08);
  if (bucketAnchoredToGround) {
    filtered = {
      ...filtered,
      travel: { left: 0, right: 0 },
    };
    vel.travel = 0;
    vel.trackTurn = 0;
  }
  const beforeGroundContact = {
    boom: sim.boom,
    arm: sim.arm,
    bucket: sim.bucket,
  };
  const beforeTravel = {
    x: sim.posX,
    z: sim.posZ,
  };
  const truckArmCollisionActive =
    truckPose.present && isDumpTruckArmCollisionActive(sim, boomSwing, truckPose);
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
      const autoInput = buildAutoArmControlInput(sim, autoPose.saved);
      stepInput = {
        ...filtered,
        left: { x: 0, y: autoInput.left.y },
        right: autoInput.right,
      };
    }
    applyControls(
      sim,
      stepInput,
      subDt,
      vel,
      hydraulicSpeedScale,
      travelSpeedScale,
      speedProfile,
    );
    constrainArmFromDumpTruck(sim, vel, boomSwing, subBefore, truckPose);
  }

  if (isAutoArm) {
    const autoBefore = {
      boom: sim.boom,
      arm: sim.arm,
      bucket: sim.bucket,
    };
    finishAutoArmPoseIfComplete(sim, vel, autoPose);
    constrainArmFromDumpTruck(sim, vel, boomSwing, autoBefore, truckPose);
  }
  if (constrainExcavatorToMap(sim, terrain)) {
    vel.travel = 0;
  }
  if (constrainExcavatorToDumpTruck(sim, beforeTravel, truckPose)) {
    vel.travel = 0;
  }

  let bucketContact = bucketClearance(sim, terrain, boomSwing);
  let { clearance } = bucketContact;
  const bucketContactInDigZone = isInDigZone(
    bucketContact.tip.x,
    bucketContact.tip.z,
    terrain,
  );
  const minBucketClearance = bucketContactInDigZone
    ? MIN_BUCKET_DIG_ZONE_CLEARANCE
    : MIN_BUCKET_GROUND_CLEARANCE;
  if (clearance < minBucketClearance - 0.02) {
    sim.boom = beforeGroundContact.boom;
    sim.arm = beforeGroundContact.arm;
    sim.bucket = beforeGroundContact.bucket;
    if (vel.boom > 0) vel.boom = 0;
    if (vel.arm > 0) vel.arm = 0;
    if (vel.bucket > 0) vel.bucket = 0;
    bucketContact = bucketClearance(sim, terrain, boomSwing);
    ({ clearance } = bucketContact);
  }
  const scraper = getBucketScraperContactWorld(sim, boomSwing);
  const bucketTip = getBucketTipWorld(sim, boomSwing);
  const bedDeckY = dumpTruckBedDeckWorldY();
  const minDumpHeight = bedDeckY + DUMP_TRUCK.dumpMinHeightAboveDeck;
  const truckBedCenter = dumpTruckBedCenterWorld(truckPose.groupX, truckPose.groupZ);
  const bucketReachY = Math.max(scraper.y, bucketTip.y);
  const scraperGroundH = sampleHeight(terrain, scraper.x, scraper.z);
  const scraperDepthBelow = scraperGroundH - scraper.y;
  updateDigZoneRespawns(terrain);
  const activeDigZones = getActiveDigZones(terrain);
  const scraperInDigZone = isInDigZone(scraper.x, scraper.z, terrain);
  const tipInDigZone = isInDigZone(bucketTip.x, bucketTip.z, terrain);
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
  const bucketNearDumpTarget =
    Math.hypot(bucketMouthCenter.x - truckBedCenter.x, bucketMouthCenter.z - truckBedCenter.z) <=
    DUMP_ZONE.radius + 1.2;
  const bodyInDumpZone = isInDumpZone(sim.posX, sim.posZ);
  const bucketOpening = sim.bucket > 1.1;
  const bucketAboveBed = bucketReachY >= minDumpHeight;
  const bodyNearDigZone = activeDigZones.some(
    (zone) => Math.hypot(sim.posX - zone.x, sim.posZ - zone.z) < zone.radius + 9,
  );
  const inZone = scraperInDigZone || tipInDigZone || bodyNearDigZone;
  const bucketContactsInDump =
    isInDumpZone(scraper.x, scraper.z) || isInDumpZone(bucketTip.x, bucketTip.z);
  const bucketReadyOverTruck = bucketNearDumpTarget && (bucketAboveBed || bucketOpening);
  const inDump = bodyInDumpZone || bucketContactsInDump || bucketOverTruck || bucketReadyOverTruck;
  const inTruckDumpTarget = bucketOverTruck || bucketReadyOverTruck;
  const bucketInWorkRange = scraperDepthBelow > -1.4 && scraperDepthBelow < 2.6;
  const tipOnGround = scraperDepthBelow > -1.2 && scraperDepthBelow < 2.6;
  const curled = isBucketCurled(sim.boom, sim.bucket);
  const bucketOpenReady = sim.bucket >= 0.35 && sim.bucket <= 1.85;
  const insertedDeepEnough = scraperDepthBelow >= -0.15 && scraperDepthBelow <= 2.75;
  const autoSaved = isAutoArm ? autoPose.saved : null;
  const autoActiveJoint = autoSaved ? getActiveAutoPoseJoint(sim, autoSaved) : null;
  const bucketCurlingInward =
    filtered.right.x < -0.08 ||
    (autoActiveJoint === "bucket" && autoSaved != null);
  const bucketCurlReady =
    (bucketCurlingInward && sim.bucket <= 1.85) ||
    (autoActiveJoint === "bucket" && autoSaved != null && sim.bucket <= 1.85);
  const armPulling =
    filtered.left.y > 0.05 ||
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
      : getAutoDigPoseReadiness(sim, autoSaved, insertedDeepEnough, bucketOpenReady);
  const poseReadiness = isAutoArm
    ? Math.max(manualDigPoseScore / 4, autoDigPoseScore)
    : manualDigPoseScore / 4;
  const canLoad =
    bucketInWorkRange &&
    (poseReadiness >= 0.5 || (isAutoArm && autoDigPoseScore >= 0.25)) &&
    (bucketCurlingInward || autoActiveJoint != null);

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
  const truckCanAccept = canDumpTruckAcceptDump(truckState, stats.truckCapacityUnits);
  const truckFillRatio = getDumpTruckFillRatio(truckState, stats.truckCapacityUnits);
  fb.truckPresent = isDumpTruckVisible(truckState);
  fb.truckCanAccept = truckCanAccept;
  fb.truckFillRatio = truckFillRatio;
  fb.truckCooldownRemaining = getDumpTruckReturnEtaSec(truckState, stats.truckCooldownSec);
  fb.canDump = inTruckDumpTarget && sim.bucketLoad > 0.02 && truckCanAccept;
  fb.raiseArmForDump =
    inDump && sim.bucketLoad > 0.02 && bucketOverTruck && !bucketAboveBed && !bucketOpening;
  fb.travelBlockedRaiseArm = bucketAnchoredToGround && wantsTravel;

  const isGame = mode === "game";
  const isTutorial = mode === "tutorial";
  const digRate = isTutorial ? 9.5 : 7.2;
  const loadRate = isTutorial ? 7.0 : 5.4;

  if (inZone && bucketInWorkRange && sim.bucketLoad < 1) {
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
      Math.max(0, filtered.left.y) * 0.75 +
      Math.abs(filtered.right.y) * 0.3 +
      Math.max(0, -filtered.right.x) * 0.42;
    const autoDigLoadingActive =
      isAutoArm &&
      autoSaved != null &&
      isAutoPoseDigLoadingActive(sim, autoSaved, {
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
      sim.bucketLoad = Math.min(1, sim.bucketLoad + loadDelta);
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

  const bucketDumpOpen = sim.bucket > 1.35;
  if (sim.bucketLoad > 0 && bucketDumpOpen && inTruckDumpTarget && truckCanAccept) {
    const spillRate = 1.65;
    const remainingLoad = sim.bucketLoad;
    const dumpAmount =
      remainingLoad < 0.025
        ? remainingLoad
        : Math.min(remainingLoad, remainingLoad * spillRate * dt);
    sim.bucketLoad = Math.max(0, sim.bucketLoad - dumpAmount);
    addDumpTruckLoad(truckState, dumpAmount * stats.maxLoadUnits, stats.truckCapacityUnits);
    runtime.dumpSoilVisual.active = true;
    runtime.dumpSoilVisual.intensity = Math.min(
      1.2,
      runtime.dumpSoilVisual.intensity + dumpAmount * 6.5,
    );
    runtime.dumpSoilVisual.spawnX = bucketMouthCenter.x;
    runtime.dumpSoilVisual.spawnY = Math.max(bucketReachY, bedDeckY + 0.35);
    runtime.dumpSoilVisual.spawnZ = bucketMouthCenter.z;
    if (isGame) {
      score.dumped += dumpAmount;
      const progress = Math.min(100, Math.round((score.dumped / score.target) * 100));
      if (progress !== runtime.lastReportedProgress) {
        runtime.lastReportedProgress = progress;
        onProgress(score.dumped, progress);
      }
    } else {
      tutorialDump.current += dumpAmount;
    }

    const chunkRatio = stats.scoreChunkUnits / stats.maxLoadUnits;
    runtime.dumpScoreRemainder += dumpAmount;
    while (runtime.dumpScoreRemainder >= chunkRatio) {
      runtime.dumpScoreRemainder -= chunkRatio;
      const critical = Math.random() < stats.criticalChance;
      const dropPoint = clampToDumpTruckBed(
        bucketMouthCenter.x,
        bucketMouthCenter.z,
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

  runtime.dumpSoilVisual.intensity = Math.max(0, runtime.dumpSoilVisual.intensity - dt * 2.8);
  if (runtime.dumpSoilVisual.intensity <= 0.02) {
    runtime.dumpSoilVisual.active = false;
  }

  onSimTick();
}
