import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advanceFloodBurn,
  beginFloodTrashCarry,
  createFloodRecoveryZone,
  createTerrain,
  depositFloodTrashToIncinerator,
  failFloodTrashCarry,
  floodFieldDebrisBudget,
  isFloodDebrisFull,
  isInsideFloodIncinerator,
  isInsideFloodRecoveryCircle,
  pushFloodDebrisToCollection,
  respawnFloodFieldDebris,
  tryStartFloodBurn,
  updateSpecialZones,
  FLOOD_ZONE_RESPAWN_MS,
  type TerrainData,
} from "../terrain";
import {
  FLOOD_COLLECTION_GRAB_RADIUS,
  FLOOD_COLLECTION_THRESHOLD,
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

describe("floodRecovery/cycle", () => {
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
      size: 0.52,
      roundness: 0.58,
      comOffsetX: 0,
      comOffsetZ: 0,
      active: true,
      delivered: false,
      extracted: false,
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

  it("respawns field debris 5 minutes after the player leaves the flood circle", () => {
    const terrain = withFloodTerrain();
    const zone = terrain.floodZone!;
    assert.equal(isFloodDebrisFull(zone), true);

    // Empty the field (scraped into the pad / burned path) so leave-regen can arm.
    zone.sourceRemaining = 0;
    zone.debris = zone.debris.map((d) => ({
      ...d,
      remaining: 0,
      active: false,
    }));
    assert.equal(isFloodDebrisFull(zone), false);

    const outsideX = zone.centerX + zone.radius + 2;
    const outsideZ = zone.centerZ;
    assert.equal(isInsideFloodRecoveryCircle(zone, outsideX, outsideZ), false);

    const t0 = 1_000_000;
    updateSpecialZones(terrain, 0, t0, undefined, undefined, undefined, outsideX, outsideZ);
    assert.equal(zone.debrisLeftAt, t0);
    assert.equal(zone.debrisRespawnAt, t0 + FLOOD_ZONE_RESPAWN_MS);

    // Re-entering cancels the leave timer (crash-style).
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
    assert.equal(zone.debrisLeftAt, null);
    assert.equal(zone.debrisRespawnAt, null);

    // Leave again and wait out the full 5 minutes.
    updateSpecialZones(terrain, 0, t0 + 120_000, undefined, undefined, undefined, outsideX, outsideZ);
    assert.equal(zone.debrisLeftAt, t0 + 120_000);
    updateSpecialZones(
      terrain,
      0,
      t0 + 120_000 + FLOOD_ZONE_RESPAWN_MS,
      undefined,
      undefined,
      undefined,
      outsideX,
      outsideZ,
    );
    assert.equal(isFloodDebrisFull(zone), true);
    assert.equal(zone.sourceRemaining, floodFieldDebrisBudget(zone));
    assert.ok(zone.debris.some((d) => d.active && d.remaining > 0));
    assert.equal(zone.debrisLeftAt, null);
    assert.equal(zone.debrisRespawnAt, null);
  });

  it("also arms debris regen when piles were blade-scraped", () => {
    const terrain = withFloodTerrain();
    const zone = terrain.floodZone!;
    zone.debris[0]!.yaw = 1.2;
    zone.debris[0]!.cleaved = true;
    assert.equal(isFloodDebrisFull(zone), false);

    const outsideX = zone.centerX + zone.radius + 2;
    const t0 = 2_000_000;
    updateSpecialZones(terrain, 0, t0, undefined, undefined, undefined, outsideX, zone.centerZ);
    assert.ok(zone.debrisRespawnAt);

    updateSpecialZones(
      terrain,
      0,
      t0 + FLOOD_ZONE_RESPAWN_MS,
      undefined,
      undefined,
      undefined,
      outsideX,
      zone.centerZ,
    );
    assert.equal(isFloodDebrisFull(zone), true);
    assert.equal(zone.debris.some((d) => d.cleaved || d.yaw != null), false);
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
  });
});
