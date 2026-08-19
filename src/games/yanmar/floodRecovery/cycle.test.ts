import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advanceFloodBurn,
  advanceFloodDebrisBladePush,
  beginFloodTrashCarry,
  createFloodRecoveryZone,
  createTerrain,
  depositFloodTrashToIncinerator,
  failFloodTrashCarry,
  isInsideFloodIncinerator,
  pushFloodDebrisToCollection,
  respawnFloodFieldDebris,
  tryStartFloodBurn,
  updateSpecialZones,
  FLOOD_ZONE_RESPAWN_MS,
  type TerrainData,
} from "../terrain";
import {
  FLOOD_COLLECTION_ACCEPT_MARGIN,
  FLOOD_COLLECTION_GRAB_RADIUS,
  FLOOD_COLLECTION_THRESHOLD,
  FLOOD_DEBRIS_PILE_COUNT,
  FLOOD_INCINERATOR_BASE_CAPACITY,
  FLOOD_INCINERATOR_DEPOSIT_RADIUS,
  FLOOD_RECOVERY_UNLOCK_LEVEL,
} from "./balance";
import { hillBoulderGripEnvelope } from "../grappleGrip";

function withFloodTerrain(): TerrainData {
  const terrain = createTerrain(-48, -48, false, FLOOD_RECOVERY_UNLOCK_LEVEL);
  assert.ok(terrain.floodZone);
  return terrain;
}

function placeSingleDebris(
  terrain: TerrainData,
  x: number,
  z: number,
  remaining = 500,
) {
  const zone = terrain.floodZone!;
  zone.debris = [
    {
      id: `${zone.id}-probe`,
      x,
      z,
      homeX: x,
      homeZ: z,
      remaining,
      maxRemaining: remaining,
      active: true,
      regen: true,
      respawnAt: null,
    },
  ];
  zone.sourceRemaining = remaining;
  return zone.debris[0]!;
}

describe("floodRecovery/cycle", () => {
  it("spawns field debris piles of about 300–500 units each", () => {
    const terrain = withFloodTerrain();
    const zone = terrain.floodZone!;
    assert.ok(zone.debris.length >= 1);
    assert.ok(zone.debris.length <= FLOOD_DEBRIS_PILE_COUNT);
    assert.ok(zone.debris.every((d) => d.active && d.remaining > 0));
    for (const pile of zone.debris) {
      assert.ok(
        pile.remaining >= 300,
        `pile ${pile.id} too small (${pile.remaining})`,
      );
      assert.ok(
        pile.remaining <= 500 + 50,
        `pile ${pile.id} too large (${pile.remaining})`,
      );
      const dist = Math.hypot(
        pile.x - zone.collectionX,
        pile.z - zone.collectionZ,
      );
      assert.ok(
        dist > zone.collectionRadius,
        `pile ${pile.id} overlaps collection pad (${dist})`,
      );
    }
  });

  it("moves debris when the blade clips the painted outline from a side approach", () => {
    const terrain = withFloodTerrain();
    const zone = terrain.floodZone!;
    // Push east (+X). Pile sits on the lateral rim of the catch zone (~2.4m right).
    const heading = Math.PI / 2;
    let bladeX = zone.collectionX + 10;
    const bladeZ = zone.collectionZ + 8;
    const hit = placeSingleDebris(terrain, bladeX + 0.6, bladeZ + 2.4, 400);
    const before = { x: hit.x, z: hit.z };

    // Advance the blade like a real scrape so face-snapping cannot cancel motion.
    for (let step = 0; step < 4; step += 1) {
      bladeX += 0.7;
      advanceFloodDebrisBladePush(terrain, bladeX, bladeZ, heading, 0.7);
    }

    assert.ok(hit.x > before.x + 1.5, "pile on the outline rim should still ride the blade");
    assert.ok(Math.abs(hit.yaw! - heading) < 1e-6);
  });

  it("banks debris ahead of the blade in the travel direction from any approach", () => {
    const terrain = withFloodTerrain();
    const zone = terrain.floodZone!;
    const heading = Math.PI; // push toward -Z
    const bladeX = zone.collectionX;
    const bladeZ = zone.collectionZ + 8;
    const hit = placeSingleDebris(terrain, bladeX + 0.4, bladeZ - 1.1, 280);
    const before = { x: hit.x, z: hit.z };

    advanceFloodDebrisBladePush(terrain, bladeX, bladeZ, heading, 0.9);

    // Travel direction is (sin π, cos π) = (0, -1) → z decreases.
    assert.ok(hit.z < before.z);
    assert.ok(Math.abs(hit.yaw! - heading) < 1e-6);
    const localFwd =
      (hit.x - bladeX) * Math.sin(heading) + (hit.z - bladeZ) * Math.cos(heading);
    assert.ok(localFwd > 0.05, "scraped trash should stay ahead of the blade face");
  });

  it("fills collection at 500 and awards collect only once per cycle", () => {
    const terrain = withFloodTerrain();
    const zone = terrain.floodZone!;
    // A blade must physically push a windrow over the pad rim before it is
    // accepted into the collection load.
    assert.equal(
      pushFloodDebrisToCollection(terrain, FLOOD_COLLECTION_THRESHOLD).moved,
      0,
    );
    for (const pile of zone.debris) {
      pile.x = zone.collectionX;
      pile.z = zone.collectionZ;
    }

    const first = pushFloodDebrisToCollection(terrain, FLOOD_COLLECTION_THRESHOLD);
    assert.equal(first.moved, FLOOD_COLLECTION_THRESHOLD);
    assert.equal(first.collectionFilled, true);
    zone.rewardedCollect = true;

    beginFloodTrashCarry(terrain);
    depositFloodTrashToIncinerator(terrain);

    const second = pushFloodDebrisToCollection(terrain, FLOOD_COLLECTION_THRESHOLD);
    assert.equal(second.moved, FLOOD_COLLECTION_THRESHOLD);
    assert.equal(second.collectionFilled, false);
  });

  it("accepts debris just outside the painted pad rim within the transfer margin", () => {
    const terrain = withFloodTerrain();
    const zone = terrain.floodZone!;
    const pile = placeSingleDebris(
      terrain,
      zone.collectionX + zone.collectionRadius + FLOOD_COLLECTION_ACCEPT_MARGIN * 0.7,
      zone.collectionZ,
      400,
    );
    const result = pushFloodDebrisToCollection(terrain, 400);
    assert.equal(result.moved, 400);
    assert.equal(pile.active, false);
  });

  it("drags debris in the blade sweep and ignores piles outside it", () => {
    const terrain = withFloodTerrain();
    const zone = terrain.floodZone!;
    const heading = 0;
    const bladeX = zone.collectionX;
    const bladeZ = zone.collectionZ - 8;
    const hit = placeSingleDebris(terrain, bladeX, bladeZ + 1.2, 300);
    zone.debris.push({
      id: `${zone.id}-miss`,
      x: bladeX + 5.5,
      z: bladeZ + 1.2,
      homeX: bladeX + 5.5,
      homeZ: bladeZ + 1.2,
      remaining: 300,
      maxRemaining: 300,
      active: true,
      regen: true,
      respawnAt: null,
    });
    zone.sourceRemaining = 600;
    const miss = zone.debris[1]!;
    const beforeHitZ = hit.z;
    const beforeMiss = { x: miss.x, z: miss.z };

    advanceFloodDebrisBladePush(terrain, bladeX, bladeZ, heading, 0.8);

    assert.ok(hit.z > beforeHitZ);
    assert.ok(hit.yaw != null);
    assert.equal(miss.x, beforeMiss.x);
    assert.equal(miss.z, beforeMiss.z);
  });

  it("cleaves a large pile and still pushes the original fragment next frame", () => {
    const terrain = withFloodTerrain();
    const zone = terrain.floodZone!;
    const heading = Math.PI / 2;
    const bladeX = zone.collectionX - 6;
    const bladeZ = zone.collectionZ;
    placeSingleDebris(terrain, bladeX + 1.0, bladeZ, 500);
    const beforeCount = zone.debris.length;

    advanceFloodDebrisBladePush(terrain, bladeX, bladeZ, heading, 0.6);
    assert.ok(zone.debris.length > beforeCount);
    assert.ok(zone.debris.every((d) => d.cleaved || !d.active || d.remaining < 100));

    const movedIds = new Set(
      zone.debris.filter((d) => d.active && d.remaining > 0).map((d) => d.id),
    );
    advanceFloodDebrisBladePush(terrain, bladeX + 0.65, bladeZ, heading, 0.6);
    const after = zone.debris.filter((d) => d.active && d.remaining > 0);
    assert.ok(after.some((d) => movedIds.has(d.id) && d.x > bladeX + 1.0));
  });

  it("can blade-push a windrow across the pad rim into a scored collection", () => {
    const terrain = withFloodTerrain();
    const zone = terrain.floodZone!;
    const heading = 0;
    const startZ =
      zone.collectionZ - (zone.collectionRadius + FLOOD_COLLECTION_ACCEPT_MARGIN + 2.2);
    placeSingleDebris(terrain, zone.collectionX, startZ, 500);

    let bladeZ = startZ - 0.4;
    for (let step = 0; step < 18; step += 1) {
      bladeZ += 0.7;
      advanceFloodDebrisBladePush(terrain, zone.collectionX, bladeZ, heading, 0.7);
    }

    const result = pushFloodDebrisToCollection(terrain, FLOOD_COLLECTION_THRESHOLD);
    assert.ok(result.moved > 0, "expected pad-delivered debris after a blade stroke");
    assert.ok(zone.collectedUnits > 0);
  });

  it("requires leaving incinerator before burn starts", () => {
    const terrain = withFloodTerrain();
    const zone = terrain.floodZone!;
    zone.incineratorUnits = zone.incineratorCapacity;
    zone.phase = "readyToBurn";

    assert.equal(
      tryStartFloodBurn(terrain, zone.incineratorX, zone.incineratorZ),
      false,
    );
    assert.equal(zone.phase, "readyToBurn");

    assert.equal(
      tryStartFloodBurn(
        terrain,
        zone.incineratorX + zone.incineratorRadius + 3,
        zone.incineratorZ,
      ),
      true,
    );
    assert.equal(zone.phase, "burning");
  });

  it("awards the burn cycle once at start and keeps the latch through completion", () => {
    const terrain = withFloodTerrain();
    const zone = terrain.floodZone!;
    zone.incineratorUnits = zone.incineratorCapacity;
    zone.phase = "readyToBurn";
    zone.burnDurationSec = 1;

    const rewardStarts: Array<{ eventId: string; burnedUnits: number }> = [];
    assert.equal(
      tryStartFloodBurn(
        terrain,
        zone.incineratorX + zone.incineratorRadius + 3,
        zone.incineratorZ,
      ),
      true,
    );
    // Mirrors simLoop: reward is latched when burn begins.
    if (!zone.rewardedBurn) {
      zone.rewardedBurn = true;
      rewardStarts.push({
        eventId: `${zone.id}-burn`,
        burnedUnits: zone.incineratorCapacity,
      });
    }
    assert.equal(rewardStarts.length, 1);
    assert.equal(zone.rewardedBurn, true);

    // A second start cannot fire while already burning.
    assert.equal(
      tryStartFloodBurn(
        terrain,
        zone.incineratorX + zone.incineratorRadius + 3,
        zone.incineratorZ,
      ),
      false,
    );
    assert.equal(rewardStarts.length, 1);

    assert.equal(advanceFloodBurn(terrain, 1.1), true);
    assert.equal(zone.phase, "completed");
    // Completion must not reopen the cycle reward latch.
    assert.equal(zone.rewardedBurn, true);
    assert.equal(rewardStarts.length, 1);
  });

  it("completes burn and schedules respawn", () => {
    const zone = createFloodRecoveryZone();
    const terrain = withFloodTerrain();
    terrain.floodZone = zone;
    zone.phase = "burning";
    zone.burnProgress = 0;
    zone.burnDurationSec = 2;

    assert.equal(advanceFloodBurn(terrain, 1), false);
    assert.equal(advanceFloodBurn(terrain, 1.1), true);
    assert.equal(zone.phase, "completed");
    assert.equal(zone.active, false);
    assert.ok(zone.respawnAt != null);
  });

  it("keeps base incinerator capacity at 3000", () => {
    const zone = createFloodRecoveryZone();
    assert.equal(zone.incineratorCapacity, FLOOD_INCINERATOR_BASE_CAPACITY);
  });

  it("clears the carry lock and collection after a failed trash lift", () => {
    const terrain = withFloodTerrain();
    const zone = terrain.floodZone!;
    zone.collectedUnits = FLOOD_COLLECTION_THRESHOLD;
    assert.ok(beginFloodTrashCarry(terrain));
    assert.ok(zone.carriedTrashId);

    assert.equal(failFloodTrashCarry(terrain), true);
    assert.equal(zone.carriedTrashId, null);
    assert.equal(zone.collectedUnits, 0);

    // A fresh collection may be picked up again; no stale carry lock remains.
    zone.collectedUnits = FLOOD_COLLECTION_THRESHOLD;
    assert.ok(beginFloodTrashCarry(terrain));
  });

  it("blocks a new grab while a stale zone carry lock remains", () => {
    const terrain = withFloodTerrain();
    const zone = terrain.floodZone!;
    zone.collectedUnits = FLOOD_COLLECTION_THRESHOLD;
    zone.carriedTrashId = "stale-lock";
    assert.equal(beginFloodTrashCarry(terrain), null);

    zone.carriedTrashId = null;
    assert.ok(beginFloodTrashCarry(terrain));
  });

  it("keeps trash grab radius tighter than the painted collection pad", () => {
    const zone = createFloodRecoveryZone();
    // Mirrors FLOOD_TRASH_GRIP_PROFILE.size in simLoop.
    const envelope = hillBoulderGripEnvelope({
      id: "trash-probe",
      x: 0,
      z: 0,
      homeX: 0,
      homeZ: 0,
      size: 0.52,
      roundness: 0.58,
      comOffsetX: 0,
      comOffsetZ: 0,
      active: true,
      delivered: false,
      extracted: false,
      respawnAt: null,
    });
    const poseRadius = envelope.horizontalRadius + 0.4;
    assert.ok(poseRadius < zone.collectionRadius);
    assert.ok(
      Math.abs(poseRadius - FLOOD_COLLECTION_GRAB_RADIUS) < 0.15,
      `hint radius ${FLOOD_COLLECTION_GRAB_RADIUS} drifted from pose ${poseRadius}`,
    );
  });

  it("requires the grapple near the hopper to deposit, not the burn-safe radius", () => {
    const zone = createFloodRecoveryZone();
    assert.ok(zone.incineratorRadius > FLOOD_INCINERATOR_DEPOSIT_RADIUS);

    // Midway into the leave-safe ring must not count as a deposit.
    const farX = zone.incineratorX + FLOOD_INCINERATOR_DEPOSIT_RADIUS + 1.5;
    assert.equal(
      isInsideFloodIncinerator(zone, farX, zone.incineratorZ),
      false,
    );
    assert.equal(
      isInsideFloodIncinerator(
        zone,
        zone.incineratorX + FLOOD_INCINERATOR_DEPOSIT_RADIUS * 0.5,
        zone.incineratorZ,
      ),
      true,
    );
  });

  it("keeps blade-pushed debris inside the flood circle", () => {
    const terrain = withFloodTerrain();
    const zone = terrain.floodZone!;
    const edgeX = zone.centerX;
    const edgeZ = zone.centerZ + zone.radius - 1.2;
    const pile = placeSingleDebris(terrain, edgeX, edgeZ, 400);

    // Push outward past the painted flood radius.
    for (let i = 0; i < 24; i += 1) {
      advanceFloodDebrisBladePush(terrain, edgeX, edgeZ - 1.5, 0, 1.2);
    }

    const dist = Math.hypot(pile.x - zone.centerX, pile.z - zone.centerZ);
    assert.ok(
      dist <= zone.radius - 1.0,
      `debris escaped flood circle (dist=${dist}, radius=${zone.radius})`,
    );
  });

  it("respawns each emptied trash pile after 5 minutes even inside the circle", () => {
    const terrain = withFloodTerrain();
    const zone = terrain.floodZone!;
    const pile = zone.debris[0]!;
    const other = zone.debris[1]!;
    assert.ok(pile && other);

    const emptiedMax = pile.maxRemaining;
    pile.remaining = 0;
    pile.active = false;
    zone.sourceRemaining = zone.debris
      .filter((d) => d.active && d.remaining > 0)
      .reduce((sum, d) => sum + d.remaining, 0);

    const t0 = 1_000_000;
    // Still standing in the flood circle — timer must arm anyway.
    updateSpecialZones(
      terrain,
      0,
      t0,
      undefined,
      undefined,
      undefined,
      zone.centerX,
      zone.centerZ,
    );
    assert.equal(pile.respawnAt, t0 + FLOOD_ZONE_RESPAWN_MS);
    assert.equal(other.respawnAt, null);
    assert.ok(other.active && other.remaining > 0);

    // Staying inside does not cancel the timer.
    updateSpecialZones(
      terrain,
      0,
      t0 + 60_000,
      undefined,
      undefined,
      undefined,
      zone.centerX,
      zone.centerZ,
    );
    assert.equal(pile.respawnAt, t0 + FLOOD_ZONE_RESPAWN_MS);

    updateSpecialZones(
      terrain,
      0,
      t0 + FLOOD_ZONE_RESPAWN_MS,
      undefined,
      undefined,
      undefined,
      zone.centerX,
      zone.centerZ,
    );
    assert.equal(pile.active, true);
    assert.equal(pile.remaining, emptiedMax);
    assert.equal(pile.x, pile.homeX);
    assert.equal(pile.z, pile.homeZ);
    assert.equal(pile.respawnAt, null);
  });

  it("does not regenerate cleaved fragments, only spawn-slot piles", () => {
    const terrain = withFloodTerrain();
    const zone = terrain.floodZone!;
    const pile = zone.debris[0]!;
    pile.remaining = 0;
    pile.active = false;
    zone.debris.push({
      id: `${pile.id}-fragment`,
      x: pile.x + 1,
      z: pile.z + 1,
      homeX: pile.x + 1,
      homeZ: pile.z + 1,
      remaining: 0,
      maxRemaining: 120,
      active: false,
      cleaved: true,
      regen: false,
      respawnAt: null,
    });
    const fragment = zone.debris[zone.debris.length - 1]!;

    const t0 = 3_000_000;
    updateSpecialZones(terrain, 0, t0);
    assert.equal(pile.respawnAt, t0 + FLOOD_ZONE_RESPAWN_MS);
    assert.equal(fragment.respawnAt, null);

    updateSpecialZones(terrain, 0, t0 + FLOOD_ZONE_RESPAWN_MS);
    assert.equal(pile.active, true);
    assert.equal(fragment.active, false);
    assert.equal(fragment.respawnAt, null);
  });

  it("respawnFloodFieldDebris keeps incinerator and pad progress", () => {
    const terrain = withFloodTerrain();
    const zone = terrain.floodZone!;
    zone.incineratorUnits = 1000;
    zone.collectedUnits = FLOOD_COLLECTION_THRESHOLD;
    zone.sourceRemaining = 0;
    zone.debris = [];

    respawnFloodFieldDebris(zone);
    assert.equal(zone.incineratorUnits, 1000);
    assert.equal(zone.collectedUnits, FLOOD_COLLECTION_THRESHOLD);
    assert.equal(
      zone.sourceRemaining,
      zone.incineratorCapacity - 1000 - FLOOD_COLLECTION_THRESHOLD,
    );
    assert.ok(zone.debris.length > 0);
    assert.ok(zone.debris.every((d) => d.regen && d.maxRemaining > 0));
  });
});
