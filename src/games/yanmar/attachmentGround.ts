import { JOINT_LIMITS } from "./controls";
import {
  getBreakerTipWorld,
  getBucketBodyContactWorld,
  getGrappleClampWorld,
  getGrappleJawSampleWorlds,
} from "./bucket";
import {
  BREAKER_TIP_PROBE_RADIUS,
  BREAKER_TRAVEL_LOCK_CLEARANCE,
  MIN_BUCKET_GROUND_CLEARANCE,
} from "./simConstants";
import { GRAPPLE_TRAVEL_LOCK_CLEARANCE } from "./grappleGrip";
import { sampleBreakerContactHeight, sampleHeight, type TerrainData } from "./terrain";
import type { ExcavatorSimState } from "./types";

export type AttachmentClearance = {
  tip: { x: number; y: number; z: number };
  groundH: number;
  depthBelow: number;
  clearance: number;
};

/** Lowest tool-point clearance for the active attachment. */
export function measureAttachmentClearance(
  sim: ExcavatorSimState,
  terrain: TerrainData,
  boomSwing: number,
  grappleOpen = 1,
): AttachmentClearance {
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

function targetClearanceForAttachment(sim: ExcavatorSimState) {
  if (sim.attachmentType === "breaker") {
    return BREAKER_TRAVEL_LOCK_CLEARANCE + 0.08;
  }
  if (sim.attachmentType === "grapple") {
    return GRAPPLE_TRAVEL_LOCK_CLEARANCE + 0.08;
  }
  return MIN_BUCKET_GROUND_CLEARANCE + 0.07;
}

/**
 * Lift boom/arm/bucket until the active attachment clears the ground.
 * Used when swapping to breaker/grapple (longer tip) and when a dig mound
 * snaps away under a buried bucket.
 */
export function resolveAttachmentTipClearance(
  sim: ExcavatorSimState,
  terrain: TerrainData,
  boomSwing: number,
  grappleOpen = 1,
  targetClearance = targetClearanceForAttachment(sim),
): boolean {
  const step = 0.045;
  const maxIters = 96;
  const eps = 1e-4;

  for (let i = 0; i < maxIters; i++) {
    const current = measureAttachmentClearance(
      sim,
      terrain,
      boomSwing,
      grappleOpen,
    ).clearance;
    if (current >= targetClearance) return true;

    const candidates: Array<{ boom: number; arm: number; bucket: number }> = [
      {
        boom: Math.max(JOINT_LIMITS.boom.min, sim.boom - step),
        arm: sim.arm,
        bucket: sim.bucket,
      },
      {
        boom: Math.min(JOINT_LIMITS.boom.max, sim.boom + step),
        arm: sim.arm,
        bucket: sim.bucket,
      },
      {
        boom: sim.boom,
        arm: Math.min(JOINT_LIMITS.arm.max, sim.arm + step),
        bucket: sim.bucket,
      },
      {
        boom: sim.boom,
        arm: Math.max(JOINT_LIMITS.arm.min, sim.arm - step),
        bucket: sim.bucket,
      },
      {
        boom: sim.boom,
        arm: sim.arm,
        bucket: Math.max(JOINT_LIMITS.bucket.min, sim.bucket - step),
      },
      {
        boom: sim.boom,
        arm: sim.arm,
        bucket: Math.min(JOINT_LIMITS.bucket.max, sim.bucket + step),
      },
    ];

    let bestClearance = current;
    let best: (typeof candidates)[number] | null = null;
    const saved = { boom: sim.boom, arm: sim.arm, bucket: sim.bucket };

    for (const next of candidates) {
      if (
        next.boom === saved.boom &&
        next.arm === saved.arm &&
        next.bucket === saved.bucket
      ) {
        continue;
      }
      sim.boom = next.boom;
      sim.arm = next.arm;
      sim.bucket = next.bucket;
      const clearance = measureAttachmentClearance(
        sim,
        terrain,
        boomSwing,
        grappleOpen,
      ).clearance;
      if (clearance > bestClearance + eps) {
        bestClearance = clearance;
        best = next;
      }
    }

    sim.boom = saved.boom;
    sim.arm = saved.arm;
    sim.bucket = saved.bucket;

    if (!best) return false;
    sim.boom = best.boom;
    sim.arm = best.arm;
    sim.bucket = best.bucket;
  }

  return (
    measureAttachmentClearance(sim, terrain, boomSwing, grappleOpen).clearance >=
    targetClearance
  );
}
