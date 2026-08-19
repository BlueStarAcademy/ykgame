import assert from "node:assert/strict";
import test from "node:test";
import {
  HAUL_TRUCK_ALIGN,
  getHaulTruckAlignTarget,
  isExcavatorCollidingWithTruckTarget,
  resolveExcavatorTruckOverlap,
} from "../src/games/yanmar/truckDumpAlign";
import { HAUL_TRUCK } from "../src/games/yanmar/terrain";

test("haul truck collider length is on local X, width on local Z", () => {
  // HaulTruckModel: chassis 6.9 (X) × 2.55–3.3 (Z). Length must exceed width.
  assert.ok(
    HAUL_TRUCK_ALIGN.collider.halfX > HAUL_TRUCK_ALIGN.collider.halfZ,
    "halfX (length) must be greater than halfZ (width)",
  );
  assert.ok(
    HAUL_TRUCK_ALIGN.collider.halfX >= 3.4,
    "halfX must cover cab/bumper along model X",
  );
  assert.ok(
    HAUL_TRUCK_ALIGN.collider.halfZ >= 1.7,
    "halfZ must cover bed side panels along model Z",
  );
  assert.ok(
    HAUL_TRUCK_ALIGN.cavityHalfX < HAUL_TRUCK_ALIGN.collider.halfX,
    "bed cavity must stay inside the length hull",
  );
  assert.ok(
    HAUL_TRUCK_ALIGN.cavityHalfZ < HAUL_TRUCK_ALIGN.collider.halfZ,
    "bed cavity must stay inside the width hull",
  );
});

test("excavator cannot sit inside haul truck cab/bed ends", () => {
  const dropX = HAUL_TRUCK.groupX;
  const dropZ = HAUL_TRUCK.groupZ;
  const target = getHaulTruckAlignTarget(dropX, dropZ, true);
  assert.ok(target);

  // Local +X is cab end. With rotation +π/2: local (+3, 0) → world (dropX, dropZ-3).
  const insideCabX = dropX;
  const insideCabZ = dropZ - 2.4;
  const radius = 1.7;

  assert.equal(
    isExcavatorCollidingWithTruckTarget(insideCabX, insideCabZ, target, radius),
    true,
  );

  const resolved = resolveExcavatorTruckOverlap(
    insideCabX,
    insideCabZ,
    target,
    radius,
  );
  assert.ok(resolved);
  assert.equal(
    isExcavatorCollidingWithTruckTarget(resolved.x, resolved.z, target, radius),
    false,
  );
});
