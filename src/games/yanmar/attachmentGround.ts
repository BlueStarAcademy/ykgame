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

type JointPose = { boom: number; arm: number; bucket: number };

function clampJointPose(pose: JointPose): JointPose {
  return {
    boom: Math.min(
      JOINT_LIMITS.boom.max,
      Math.max(JOINT_LIMITS.boom.min, pose.boom),
    ),
    arm: Math.min(
      JOINT_LIMITS.arm.max,
      Math.max(JOINT_LIMITS.arm.min, pose.arm),
    ),
    bucket: Math.min(
      JOINT_LIMITS.bucket.max,
      Math.max(JOINT_LIMITS.bucket.min, pose.bucket),
    ),
  };
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
  const maxIters = 160;
  const eps = 1e-4;

  for (let i = 0; i < maxIters; i++) {
    const current = measureAttachmentClearance(
      sim,
      terrain,
      boomSwing,
      grappleOpen,
    ).clearance;
    if (current >= targetClearance) return true;

    // Deep burial (mound snap) needs larger steps and multi-joint moves;
    // single-axis 0.045 search often stalls in a dig-curl local minimum.
    const depth = Math.max(0, targetClearance - current);
    const step = depth > 1.2 ? 0.14 : depth > 0.45 ? 0.08 : 0.045;
    const boomRaise = Math.max(step, Math.min(0.28, depth * 0.22));

    const saved: JointPose = {
      boom: sim.boom,
      arm: sim.arm,
      bucket: sim.bucket,
    };
    const candidates: JointPose[] = [
      { boom: saved.boom - step, arm: saved.arm, bucket: saved.bucket },
      { boom: saved.boom + step, arm: saved.arm, bucket: saved.bucket },
      { boom: saved.boom, arm: saved.arm + step, bucket: saved.bucket },
      { boom: saved.boom, arm: saved.arm - step, bucket: saved.bucket },
      { boom: saved.boom, arm: saved.arm, bucket: saved.bucket - step },
      { boom: saved.boom, arm: saved.arm, bucket: saved.bucket + step },
      // Boom raise + arm (typical escape from curled dig pose)
      {
        boom: saved.boom - boomRaise,
        arm: saved.arm + step,
        bucket: saved.bucket,
      },
      {
        boom: saved.boom - boomRaise,
        arm: saved.arm - step,
        bucket: saved.bucket,
      },
      {
        boom: saved.boom - boomRaise,
        arm: saved.arm,
        bucket: saved.bucket - step,
      },
      {
        boom: saved.boom - boomRaise,
        arm: saved.arm,
        bucket: saved.bucket + step,
      },
      {
        boom: saved.boom - boomRaise,
        arm: saved.arm + step,
        bucket: saved.bucket + step,
      },
      {
        boom: saved.boom - boomRaise,
        arm: saved.arm - step,
        bucket: saved.bucket + step,
      },
    ].map(clampJointPose);

    let bestClearance = current;
    let best: JointPose | null = null;

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

    if (!best) {
      // Last resort: large boom raise only if it actually lifts the tip.
      const forced = clampJointPose({
        boom: saved.boom - Math.max(boomRaise, 0.18),
        arm: saved.arm,
        bucket: saved.bucket,
      });
      if (forced.boom >= saved.boom - eps) return false;
      sim.boom = forced.boom;
      const forcedClearance = measureAttachmentClearance(
        sim,
        terrain,
        boomSwing,
        grappleOpen,
      ).clearance;
      if (forcedClearance > current + eps) continue;
      sim.boom = saved.boom;
      return false;
    }
    sim.boom = best.boom;
    sim.arm = best.arm;
    sim.bucket = best.bucket;
  }

  return (
    measureAttachmentClearance(sim, terrain, boomSwing, grappleOpen).clearance >=
    targetClearance
  );
}
