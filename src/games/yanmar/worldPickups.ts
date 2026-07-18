import { EXCAVATOR_COLLISION_RADIUS } from "./simConstants";
import { REPAIR_TENT } from "./gearCatalog";
import { MONUMENT_SIGN } from "./monument/catalog";
import { getSiteRoadsForTier, type SiteRoad } from "./siteLayout";
import {
  DUMP_ZONE,
  getActiveDigZoneAt,
  getMapWorldBounds,
  isInCrashZone,
  isInDumpZone,
  isInHillZone,
  sampleHeight,
  type TerrainData,
} from "./terrain";

export type WorldPickupKind = "star" | "speed";

export interface WorldPickup {
  id: string;
  kind: WorldPickupKind;
  x: number;
  y: number;
  z: number;
  spawnedAt: number;
}

export interface WorldPickupsState {
  active: WorldPickup[];
  /** Asia/Seoul(KST) wall-clock hour bucket. */
  hourBucket: number;
  /** Collects in the current hour bucket (resets at KST 정시). */
  starCollectedThisHour: number;
  speedCollectedThisHour: number;
  /** Absolute timestamps (ms) for pending spawns in the current hour bucket. */
  pendingStarAt: number[];
  pendingSpeedAt: number[];
  /** Bumps when active list changes — drives React remount/sync. */
  revision: number;
  /** Local travel buff expiry (wall clock ms). 0 = inactive. */
  speedBuffUntilMs: number;
}

export const STARS_PER_HOUR = 1;
export const MAX_ACTIVE_STARS = 1;
export const SPEED_PER_HOUR = 5;
export const MAX_ACTIVE_SPEED = 1;
export const STAR_REWARD_MIN = 50;
export const STAR_REWARD_MAX = 200;
export const SPEED_BUFF_MS = 30_000;
export const SPEED_BUFF_MULT = 2;
/** After collecting a speed buff, next buff appears within this window. */
export const SPEED_RESPAWN_MAX_MS = 10 * 60 * 1000;
export const WORLD_PICKUP_RADIUS = EXCAVATOR_COLLISION_RADIUS + 0.6;
export const WORLD_PICKUP_HOVER = 1.15;
export const HOUR_MS = 3_600_000;
/** KST = UTC+9 — hour buckets align to local 정시. */
const KST_OFFSET_MS = 9 * HOUR_MS;
const MAP_EDGE_MARGIN = 10;
const ZONE_CLEARANCE = 10;
const MAX_PLACE_ATTEMPTS = 40;
const MAX_SPAWN_SLOPE = 0.55;
/** First speed spawns when entering / hour resets appear quickly. */
const INITIAL_SPAWN_JITTER_MS = 5_000;

function isNearRepairTent(wx: number, wz: number) {
  const dx = wx - REPAIR_TENT.x;
  const dz = wz - REPAIR_TENT.z;
  const r = REPAIR_TENT.radius + 4;
  return dx * dx + dz * dz <= r * r;
}

function isNearMonument(wx: number, wz: number) {
  const dx = wx - MONUMENT_SIGN.x;
  const dz = wz - MONUMENT_SIGN.z;
  const r = MONUMENT_SIGN.radius + 4;
  return dx * dx + dz * dz <= r * r;
}

/** KST wall-clock hour index (resets every local 정시). */
export function getWorldPickupHourBucket(now = Date.now()) {
  return Math.floor((now + KST_OFFSET_MS) / HOUR_MS);
}

/** Start of the given KST hour bucket (UTC epoch ms). */
export function getWorldPickupHourStartMs(hourBucket: number) {
  return hourBucket * HOUR_MS - KST_OFFSET_MS;
}

export function createWorldPickupsState(now = Date.now()): WorldPickupsState {
  const hourBucket = getWorldPickupHourBucket(now);
  const state: WorldPickupsState = {
    active: [],
    hourBucket,
    starCollectedThisHour: 0,
    speedCollectedThisHour: 0,
    pendingStarAt: [],
    pendingSpeedAt: [],
    revision: 0,
    speedBuffUntilMs: 0,
  };
  seedHourlyStar(state, now);
  seedMissingSpeedSpawns(state, now, INITIAL_SPAWN_JITTER_MS);
  return state;
}

function perHourLimit(kind: WorldPickupKind) {
  return kind === "star" ? STARS_PER_HOUR : SPEED_PER_HOUR;
}

function maxActive(kind: WorldPickupKind) {
  return kind === "star" ? MAX_ACTIVE_STARS : MAX_ACTIVE_SPEED;
}

function collectedThisHour(state: WorldPickupsState, kind: WorldPickupKind) {
  return kind === "star"
    ? state.starCollectedThisHour
    : state.speedCollectedThisHour;
}

function pendingFor(state: WorldPickupsState, kind: WorldPickupKind) {
  return kind === "star" ? state.pendingStarAt : state.pendingSpeedAt;
}

function countActive(state: WorldPickupsState, kind: WorldPickupKind) {
  return state.active.filter((p) => p.kind === kind).length;
}

/** How many more of this kind may still spawn this hour (active + pending + collected). */
function spawnSlotsRemaining(state: WorldPickupsState, kind: WorldPickupKind) {
  return (
    perHourLimit(kind) -
    collectedThisHour(state, kind) -
    countActive(state, kind) -
    pendingFor(state, kind).length
  );
}

function hourEndMs(state: WorldPickupsState) {
  return getWorldPickupHourStartMs(state.hourBucket + 1);
}

function pushPendingSpawn(
  state: WorldPickupsState,
  kind: WorldPickupKind,
  atMs: number,
) {
  const pending = pendingFor(state, kind);
  pending.push(atMs);
  pending.sort((a, b) => a - b);
}

/**
 * Stars: exactly one per KST hour. Spawn at hour open (or session join mid-hour
 * if this hour's star was not yet collected / is not already on the map).
 * After collect, wait for the next 정시 — no mid-hour respawn.
 */
function seedHourlyStar(state: WorldPickupsState, now: number) {
  if (spawnSlotsRemaining(state, "star") <= 0) return;
  if (countActive(state, "star") + state.pendingStarAt.length >= MAX_ACTIVE_STARS) {
    return;
  }
  pushPendingSpawn(state, "star", now);
}

/**
 * Schedule one future speed spawn within `maxDelayMs` (clamped to the current hour).
 */
function scheduleSpeedRespawn(
  state: WorldPickupsState,
  now: number,
  maxDelayMs: number,
) {
  if (spawnSlotsRemaining(state, "speed") <= 0) return;
  if (
    countActive(state, "speed") + state.pendingSpeedAt.length >=
    MAX_ACTIVE_SPEED
  ) {
    return;
  }
  const untilHourEnd = Math.max(0, hourEndMs(state) - now);
  if (untilHourEnd <= 0) return;
  const delay = Math.random() * Math.min(maxDelayMs, untilHourEnd);
  pushPendingSpawn(state, "speed", now + delay);
}

function seedMissingSpeedSpawns(
  state: WorldPickupsState,
  now: number,
  maxDelayMs: number,
) {
  while (
    spawnSlotsRemaining(state, "speed") > 0 &&
    countActive(state, "speed") + state.pendingSpeedAt.length < MAX_ACTIVE_SPEED
  ) {
    scheduleSpeedRespawn(state, now, maxDelayMs);
  }
}

function ensureHourBucket(state: WorldPickupsState, now: number) {
  const bucket = getWorldPickupHourBucket(now);
  if (bucket === state.hourBucket) return;
  state.hourBucket = bucket;
  state.starCollectedThisHour = 0;
  state.speedCollectedThisHour = 0;
  state.pendingStarAt = [];
  state.pendingSpeedAt = [];
  // New 정시: one star for the hour (skip if last hour's star is still on the map).
  seedHourlyStar(state, now);
  seedMissingSpeedSpawns(state, now, INITIAL_SPAWN_JITTER_MS);
}

function randomId(kind: WorldPickupKind) {
  return `${kind}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function sampleSlope(terrain: TerrainData, wx: number, wz: number) {
  const probe = Math.max(terrain.cellSize, 1);
  const slopeX =
    Math.abs(
      sampleHeight(terrain, wx + probe, wz) -
        sampleHeight(terrain, wx - probe, wz),
    ) /
    (probe * 2);
  const slopeZ =
    Math.abs(
      sampleHeight(terrain, wx, wz + probe) -
        sampleHeight(terrain, wx, wz - probe),
    ) /
    (probe * 2);
  return Math.hypot(slopeX, slopeZ);
}

function isBlockedSpawn(
  terrain: TerrainData,
  wx: number,
  wz: number,
  existing: WorldPickup[],
): boolean {
  if (isInDumpZone(wx, wz)) return true;
  if (Math.hypot(wx - DUMP_ZONE.x, wz - DUMP_ZONE.z) < DUMP_ZONE.radius + ZONE_CLEARANCE) {
    return true;
  }
  if (isNearRepairTent(wx, wz)) {
    return true;
  }
  if (isNearMonument(wx, wz)) {
    return true;
  }
  if (isInCrashZone(terrain, wx, wz)) return true;
  if (isInHillZone(terrain, wx, wz)) return true;
  if (getActiveDigZoneAt(terrain, wx, wz)) return true;
  if (sampleSlope(terrain, wx, wz) > MAX_SPAWN_SLOPE) return true;
  for (const p of existing) {
    if (Math.hypot(wx - p.x, wz - p.z) < 8) return true;
  }
  return false;
}

function sampleAlongRoad(road: SiteRoad): { x: number; z: number } {
  const [ax, az] = road.from;
  const [bx, bz] = road.to;
  const t = 0.08 + Math.random() * 0.84;
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  // Slight lateral jitter so pickups sit on the road surface, not a single line.
  const lateral = (Math.random() - 0.5) * road.width * 0.55;
  const nx = -dz / len;
  const nz = dx / len;
  return {
    x: ax + dx * t + nx * lateral,
    z: az + dz * t + nz * lateral,
  };
}

function pickSpawnPosition(
  terrain: TerrainData,
  existing: WorldPickup[],
): { x: number; y: number; z: number } | null {
  const bounds = getMapWorldBounds(terrain);
  const roads = getSiteRoadsForTier(terrain.mapTier);
  const roadAttempts = Math.min(MAX_PLACE_ATTEMPTS, Math.max(12, roads.length * 8));

  // Prefer site roads ("길거리") so pickups appear where players actually travel.
  for (let attempt = 0; attempt < roadAttempts; attempt++) {
    const road = roads[attempt % roads.length]!;
    const { x, z } = sampleAlongRoad(road);
    if (
      x < bounds.minX + MAP_EDGE_MARGIN ||
      x > bounds.maxX - MAP_EDGE_MARGIN ||
      z < bounds.minZ + MAP_EDGE_MARGIN ||
      z > bounds.maxZ - MAP_EDGE_MARGIN
    ) {
      continue;
    }
    if (isBlockedSpawn(terrain, x, z, existing)) continue;
    const ground = sampleHeight(terrain, x, z);
    return { x, y: ground + WORLD_PICKUP_HOVER, z };
  }

  // Fallback: open map (roads may be fully blocked by zones).
  for (let attempt = 0; attempt < MAX_PLACE_ATTEMPTS; attempt++) {
    const x =
      bounds.minX +
      MAP_EDGE_MARGIN +
      Math.random() * (bounds.maxX - bounds.minX - MAP_EDGE_MARGIN * 2);
    const z =
      bounds.minZ +
      MAP_EDGE_MARGIN +
      Math.random() * (bounds.maxZ - bounds.minZ - MAP_EDGE_MARGIN * 2);
    if (isBlockedSpawn(terrain, x, z, existing)) continue;
    const ground = sampleHeight(terrain, x, z);
    return { x, y: ground + WORLD_PICKUP_HOVER, z };
  }
  return null;
}

function trySpawnKind(
  state: WorldPickupsState,
  kind: WorldPickupKind,
  terrain: TerrainData,
  now: number,
) {
  const pending = pendingFor(state, kind);
  const limit = perHourLimit(kind);
  const cap = maxActive(kind);

  while (pending.length > 0 && pending[0]! <= now) {
    const collected = collectedThisHour(state, kind);
    const active = countActive(state, kind);
    if (collected + active >= limit) {
      pending.length = 0;
      break;
    }
    if (active >= cap) {
      // Hold due times until a slot frees; do not drop the schedule.
      break;
    }

    const pos = pickSpawnPosition(terrain, state.active);
    pending.shift();
    if (!pos) {
      // Placement failed — retry soon (not the full collect-respawn window).
      if (kind === "star") {
        pushPendingSpawn(state, "star", now + INITIAL_SPAWN_JITTER_MS);
      } else {
        scheduleSpeedRespawn(state, now, INITIAL_SPAWN_JITTER_MS * 4);
      }
      continue;
    }

    state.active.push({
      id: randomId(kind),
      kind,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      spawnedAt: now,
    });
    state.revision += 1;
  }
}

/**
 * Advance spawn schedule for the current hour. Call every sim tick in game mode.
 */
export function tickWorldPickups(
  state: WorldPickupsState,
  terrain: TerrainData,
  now = Date.now(),
) {
  ensureHourBucket(state, now);
  trySpawnKind(state, "star", terrain, now);
  trySpawnKind(state, "speed", terrain, now);

  // Refresh hover height to follow terrain (asphalt pads etc.)
  for (const p of state.active) {
    p.y = sampleHeight(terrain, p.x, p.z) + WORLD_PICKUP_HOVER;
  }
}

export function tryCollectWorldPickup(
  state: WorldPickupsState,
  posX: number,
  posZ: number,
  now = Date.now(),
): WorldPickup | null {
  ensureHourBucket(state, now);
  const r2 = WORLD_PICKUP_RADIUS * WORLD_PICKUP_RADIUS;
  for (let i = 0; i < state.active.length; i++) {
    const p = state.active[i]!;
    const dx = posX - p.x;
    const dz = posZ - p.z;
    if (dx * dx + dz * dz > r2) continue;

    if (collectedThisHour(state, p.kind) >= perHourLimit(p.kind)) {
      // Hourly collect cap — leave the pickup on the map until the next 정시.
      continue;
    }

    state.active.splice(i, 1);
    state.revision += 1;

    if (p.kind === "star") {
      state.starCollectedThisHour += 1;
      // Next star waits for the following KST 정시 (ensureHourBucket).
    } else {
      state.speedCollectedThisHour += 1;
      state.speedBuffUntilMs = now + SPEED_BUFF_MS;
      scheduleSpeedRespawn(state, now, SPEED_RESPAWN_MAX_MS);
    }

    return p;
  }
  return null;
}

export function isWorldSpeedBuffActive(
  state: WorldPickupsState,
  now = Date.now(),
) {
  return state.speedBuffUntilMs > now;
}

export function rollClientStarReward() {
  return (
    STAR_REWARD_MIN +
    Math.floor(Math.random() * (STAR_REWARD_MAX - STAR_REWARD_MIN + 1))
  );
}

/** Toast amount font size grows with reward (50 → compact, 200 → large). */
export function starRewardToastFontRem(stars: number): number {
  const clamped = Math.max(
    STAR_REWARD_MIN,
    Math.min(STAR_REWARD_MAX, stars),
  );
  const t =
    (clamped - STAR_REWARD_MIN) / (STAR_REWARD_MAX - STAR_REWARD_MIN || 1);
  return 0.95 + t * 0.95;
}

/** Matching icon size for the star reward toast. */
export function starRewardToastIconPx(stars: number): number {
  const rem = starRewardToastFontRem(stars);
  return Math.round(22 + (rem - 0.95) * 28);
}
