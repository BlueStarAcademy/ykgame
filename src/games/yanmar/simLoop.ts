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
  damageCrashTile,
  getCrashTileAt,
  isInsideHillZoneCore,
  markHillRockExtracted,
  tryClearHillZone,
  digZoneLabel,
  getDigZoneRespawnEtaSec,
  sampleHeight,
  updateDigZoneRespawns,
  updateSpecialZones,
  worldToDumpTruckLocal,
  type TerrainData,
  DUMP_ZONE,
  DUMP_TRUCK,
} from "./terrain";
import { checkAttachmentUse, getZoneAt } from "./attachmentZones";
import {
  BUCKET_SOIL_HOLD_MIN,
  getBreakerGroundAngleDeg,
  getBreakerTipWorld,
  getBucketBodyContactWorld,
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
  warningCooldown: number;
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
    warningCooldown: 0,
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
  onSimTick: () => void;
}

function clampControl(value: number, min = -1, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function bucketClearance(sim: ExcavatorSimState, terrain: TerrainData, boomSwing: number) {
  const tip =
    sim.attachmentType === "breaker"
      ? getBreakerTipWorld(sim, boomSwing)
      : getBucketBodyContactWorld(sim, boomSwing);
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
  runtime.dumpSoilVisual.spawnX = mouth.x;
  runtime.dumpSoilVisual.spawnY = Math.max(bucketReachY, bedDeckY + 0.35);
  runtime.dumpSoilVisual.spawnZ = mouth.z;
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
    onCrashTileDestroyed,
    onHillRockDelivered,
    onAttachmentWarning,
    onSimTick,
  } = params;

  updateDumpTruckState(truckState, dt, stats.truckCooldownSec);
  updateSpecialZones(
    terrain,
    dt,
    Date.now(),
    stats.crashRespawnSec,
    stats.haulTruckCooldownSec,
  );
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
  const hydraulicSpeedScale = isRide
    ? auxiliary?.highSpeed
      ? 1.15
      : 1
    : auxiliary?.highSpeed
      ? 0.5
      : 0.25;
  const speedProfile = isRide ? RIDE_CONTROL_SPEED : CONTROL_SPEED;
  const travelSpeedScale = isRide ? 1 : stats.travelSpeedMultiplier;
  const boomSwing = auxiliary?.boomSwing ?? DEFAULT_BOOM_SWING;
  const beforeControlBucket = bucketClearance(sim, terrain, boomSwing);
  const bucketTipInDigZone = isInDigZone(
    beforeControlBucket.tip.x,
    beforeControlBucket.tip.z,
    terrain,
  );
  const bucketAnchoredToGround =
    sim.attachmentType === "bucket" &&
    bucketTipInDigZone &&
    beforeControlBucket.clearance < -0.05;
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
    vel.trackLeft = 0;
    vel.trackRight = 0;
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
      const autoInput = buildAutoArmControlInput(sim, autoPose);
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
    if (isAutoArm) {
      advanceAutoArmPose(sim, vel, autoPose);
    }
    constrainArmFromDumpTruck(sim, vel, boomSwing, subBefore, truckPose);
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
  const targetPosY = bodyGround - 0.72;
  const verticalFollow = (targetPosY - sim.posY) * Math.min(1, dt * 18);
  // Cap both rise and drop so sharp pivots over height samples cannot fling the body.
  const maxStep = dt * 1.2;
  sim.posY += Math.max(-maxStep, Math.min(maxStep, verticalFollow));
  if (constrainExcavatorToDumpTruck(sim, beforeTravel, truckPose)) {
    vel.travel = 0;
    vel.trackTurn = 0;
    vel.trackLeft = 0;
    vel.trackRight = 0;
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
  const wasAlreadyBelowGround =
    beforeControlBucket.clearance < minBucketClearance - 0.02;
  const worsenedGroundPenetration =
    clearance < beforeControlBucket.clearance - 0.002;
  // 굴착지 소진으로 지면이 복구되어 버킷이 순간적으로 묻힌 경우,
  // 더 깊게 파고드는 조작만 막고 지면에서 빠져나오는 조작은 허용한다.
  if (
    clearance < minBucketClearance - 0.02 &&
    (!wasAlreadyBelowGround || worsenedGroundPenetration)
  ) {
    sim.boom = beforeGroundContact.boom;
    sim.arm = beforeGroundContact.arm;
    sim.bucket = beforeGroundContact.bucket;
    if (vel.boom > 0) vel.boom = 0;
    if (vel.arm > 0) vel.arm = 0;
    if (vel.bucket > 0) vel.bucket = 0;
    bucketContact = bucketClearance(sim, terrain, boomSwing);
    ({ clearance } = bucketContact);
  }
  if (isAutoArm) {
    advanceAutoArmPose(sim, vel, autoPose);
  }
  const scraper = getBucketScraperContactWorld(sim, boomSwing);
  const bucketTip = getBucketTipWorld(sim, boomSwing);
  const toolTip =
    sim.attachmentType === "breaker"
      ? getBreakerTipWorld(sim, boomSwing)
      : bucketTip;
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
  const toolZone = getZoneAt(toolTip.x, toolTip.z, terrain);
  const toolGround = sampleHeight(terrain, toolTip.x, toolTip.z);
  const toolTouchesGround = toolTip.y - toolGround <= 0.12;
  const breakerGroundAngle =
    sim.attachmentType === "breaker"
      ? getBreakerGroundAngleDeg(sim, boomSwing)
      : 90;
  const breakerAngleReady =
    breakerGroundAngle >= MIN_BREAKER_GROUND_ANGLE_DEG;
  const toolInputActive =
    Math.abs(filtered.right.x) > 0.2 || Math.abs(filtered.left.y) > 0.2;
  const warnAttachment = (message?: string) => {
    if (!message || runtime.warningCooldown > 0) return;
    runtime.warningCooldown = 3;
    onAttachmentWarning(message);
  };

  if (sim.attachmentType === "breaker" && (auxiliary?.breakerPedal ?? false)) {
    const permission = checkAttachmentUse("breaker", toolZone, "strike");
    if (!permission.allowed) {
      if (toolTouchesGround) warnAttachment(permission.message);
    } else if (toolTouchesGround && !breakerAngleReady) {
      warnAttachment("브레이커를 수직에 가깝게 세우세요.");
    } else if (toolTouchesGround && runtime.attachmentActionCooldown <= 0) {
      const tile = getCrashTileAt(terrain, toolTip.x, toolTip.z);
      if (tile?.active) {
        const hitDamage = stats.breakerDamage;
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

  if (sim.attachmentType === "grapple" && toolInputActive) {
    const permission = checkAttachmentUse("grapple", toolZone, "grab");
    if (!permission.allowed && toolTouchesGround) {
      warnAttachment(permission.message);
    } else if (permission.allowed && runtime.attachmentActionCooldown <= 0) {
      const hill = terrain.hillZone;
      const closing = filtered.right.x < -0.2 || sim.bucket <= 0.72;
      const opening = filtered.right.x > 0.2 || sim.bucket >= 1.32;
      if (hill?.active && !sim.carriedBoulderId && closing) {
        const rock = hill.boulders
          .filter((item) => item.active && !item.delivered && !item.extracted)
          .map((item) => ({
            item,
            distance: Math.hypot(item.x - bucketTip.x, item.z - bucketTip.z),
          }))
          .sort((a, b) => a.distance - b.distance)[0];
        if (rock && rock.distance <= 2.6) {
          rock.item.active = false;
          sim.carriedBoulderId = rock.item.id;
          runtime.attachmentActionCooldown = 0.5;
        }
      } else if (hill && sim.carriedBoulderId && opening) {
        const atDrop =
          Math.hypot(bucketTip.x - hill.dropX, bucketTip.z - hill.dropZ) <= 5;
        if (atDrop && addHaulTruckRock(terrain)) {
          const rock = hill.boulders.find(
            (item) => item.id === sim.carriedBoulderId,
          );
          if (rock) {
            rock.delivered = true;
            rock.extracted = true;
            rock.active = false;
          }
          const deliveredId = sim.carriedBoulderId;
          sim.carriedBoulderId = null;
          runtime.attachmentActionCooldown = 0.6;
          tryClearHillZone(terrain);
          onHillRockDelivered(deliveredId);
        }
      }
    }
  }

  // 집어서 돌 구역 밖으로 나가면 반출 처리. 전부 반출되면 구역이 사라진다.
  if (terrain.hillZone?.active && sim.carriedBoulderId) {
    if (!isInsideHillZoneCore(terrain.hillZone, sim.posX, sim.posZ)) {
      markHillRockExtracted(terrain, sim.carriedBoulderId);
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
  const canLoad =
    sim.attachmentType === "bucket" &&
    inZone &&
    bucketInWorkRange &&
    sim.bucketLoad < 0.98 &&
    soilRetention >= BUCKET_SOIL_HOLD_MIN &&
    (poseReadiness >= 0.5 || (isAutoArm && autoDigPoseScore >= 0.25));

  const crashTileAtTip =
    sim.attachmentType === "breaker"
      ? getCrashTileAt(terrain, toolTip.x, toolTip.z)
      : null;
  const breakerNeedsVertical =
    sim.attachmentType === "breaker" &&
    toolZone === "crash" &&
    toolTouchesGround &&
    !!crashTileAtTip?.active &&
    !breakerAngleReady;
  const canStrike =
    sim.attachmentType === "breaker" &&
    toolZone === "crash" &&
    toolTouchesGround &&
    breakerAngleReady &&
    !!crashTileAtTip?.active;

  const hillZone = terrain.hillZone;
  const nearestHillRock =
    sim.attachmentType === "grapple" && hillZone?.active && !sim.carriedBoulderId
      ? hillZone.boulders
          .filter((item) => item.active && !item.delivered && !item.extracted)
          .map((item) => ({
            item,
            distance: Math.hypot(item.x - bucketTip.x, item.z - bucketTip.z),
          }))
          .sort((a, b) => a.distance - b.distance)[0]
      : null;
  const canGrab =
    sim.attachmentType === "grapple" &&
    toolZone === "hill" &&
    !sim.carriedBoulderId &&
    !!nearestHillRock &&
    nearestHillRock.distance <= 2.6;
  const canDropRock =
    sim.attachmentType === "grapple" &&
    !!sim.carriedBoulderId &&
    !!hillZone &&
    Math.hypot(bucketTip.x - hillZone.dropX, bucketTip.z - hillZone.dropZ) <= 5;

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
  fb.canDropRock = canDropRock;
  if (crashTileAtTip?.active) {
    fb.crashTileHp = crashTileAtTip.hp;
    fb.crashTileMaxHp = crashTileAtTip.maxHp;
  } else {
    fb.crashTileHp = 0;
    fb.crashTileMaxHp = 0;
  }
  fb.groundDepth = scraperDepthBelow;
  fb.digging = false;
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
  fb.truckPresent = isDumpTruckVisible(truckState);
  fb.truckCanAccept = truckCanAccept;
  fb.truckFillRatio = truckFillRatio;
  fb.truckCooldownRemaining = getDumpTruckReturnEtaSec(truckState, stats.truckCooldownSec);
  fb.digCooldowns = terrain.dynamicDigZones
    ? terrain.digZones
        .map((zone, index) => ({
          id: zone.id,
          label: digZoneLabel(zone.id, index),
          etaSec: getDigZoneRespawnEtaSec(zone),
        }))
        .filter((zone) => zone.etaSec > 0)
    : [];
  fb.canDump = inTruckDumpTarget && sim.bucketLoad > 0.02 && truckCanAccept;
  fb.raiseArmForDump =
    inDump && sim.bucketLoad > 0.02 && bucketOverTruck && !bucketAboveBed && !bucketOpening;
  fb.travelBlockedRaiseArm = bucketAnchoredToGround && wantsTravel;

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
    warnAttachment(permission.message);
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
    sim.bucketLoad > soilRetention + 0.002
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
    warnAttachment(permission.message);
  }
  if (
    sim.attachmentType === "bucket" &&
    sim.bucketLoad > 0 &&
    bucketDumpOpen
  ) {
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

  runtime.dumpSoilVisual.intensity = Math.max(0, runtime.dumpSoilVisual.intensity - dt * 2.8);
  if (runtime.dumpSoilVisual.intensity <= 0.02) {
    runtime.dumpSoilVisual.active = false;
  }

  const bladeAmount = auxiliary?.blade ?? 0;
  const bladeGroundProbe = getDozerBladeContactWorld(sim, Math.min(1, Math.max(0, bladeAmount)));
  const bladeGroundY = sampleHeight(terrain, bladeGroundProbe.x, bladeGroundProbe.z);
  const effectiveBlade = Math.min(bladeAmount, getMaxDozerBladeFromGround(sim, bladeGroundY));
  const bladeContact = getDozerBladeContactWorld(sim, effectiveBlade);
  const bladeClearance = bladeContact.y - bladeGroundY;
  const forwardTravel = Math.max(0, vel.travel);
  const bladeInSoilField = isInDigZone(bladeContact.x, bladeContact.z, terrain);
  const bladeScraping =
    effectiveBlade > 0.55 &&
    bladeClearance < 0.12 &&
    forwardTravel > 0.35 &&
    bladeInSoilField;
  if (bladeScraping) {
    runtime.bladeSpray.active = true;
    runtime.bladeSpray.intensity = Math.min(
      1.35,
      runtime.bladeSpray.intensity + forwardTravel * dt * 1.8,
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

  onSimTick();
}
