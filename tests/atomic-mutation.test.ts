import assert from "node:assert/strict";
import test from "node:test";
import { mutatedExactlyOne } from "../src/lib/atomic-mutation";

test("conditional mutations succeed only for exactly one row", () => {
  assert.equal(mutatedExactlyOne(1), true);
  assert.equal(mutatedExactlyOne(0), false);
  assert.equal(mutatedExactlyOne(2), false);
  assert.equal(mutatedExactlyOne(-1), false);
});
