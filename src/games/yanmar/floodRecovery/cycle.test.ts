import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advanceFloodBurn,
  beginFloodTrashCarry,
  createFloodRecoveryZone,
  createTerrain,
  depositFloodTrashToIncinerator,
  pushFloodDebrisToCollection,
  tryStartFloodBurn,
  type TerrainData,
} from "../terrain";
import {
  FLOOD_COLLECTION_THRESHOLD,
  FLOOD_INCINERATOR_BASE_CAPACITY,
  FLOOD_RECOVERY_UNLOCK_LEVEL,
} from "./balance";

function withFloodTerrain(): TerrainData {
  const terrain = createTerrain(-48, -48, false, FLOOD_RECOVERY_UNLOCK_LEVEL);
  assert.ok(terrain.floodZone);
  return terrain;
}

describe("floodRecovery/cycle", () => {
  it("fills collection at 500 and awards collect only once per cycle", () => {
    const terrain = withFloodTerrain();
    const first = pushFloodDebrisToCollection(terrain, FLOOD_COLLECTION_THRESHOLD);
    assert.equal(first.moved, FLOOD_COLLECTION_THRESHOLD);
    assert.equal(first.collectionFilled, true);
    terrain.floodZone!.rewardedCollect = true;

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
});
