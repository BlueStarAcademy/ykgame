import type { ExcavatorSimState } from "./ExcavatorScene";

const BOOM_LEN = 3;
const ARM_LEN = 2.5;
const BUCKET_LEN = 1.2;
const BOOM_PIVOT_Y = 1.0;
const BOOM_OFFSET = 0.8;

export interface BucketTip {
  x: number;
  y: number;
  z: number;
}

export function getBucketTipWorld(sim: ExcavatorSimState): BucketTip {
  const angle = sim.heading + sim.swing;
  const reach =
    Math.sin(sim.boom) * BOOM_LEN +
    Math.sin(sim.boom + sim.arm) * ARM_LEN +
    Math.sin(sim.boom + sim.arm + sim.bucket) * BUCKET_LEN;

  const height =
    BOOM_PIVOT_Y +
    Math.cos(sim.boom) * BOOM_LEN +
    Math.cos(sim.boom + sim.arm) * ARM_LEN +
    Math.cos(sim.boom + sim.arm + sim.bucket) * BUCKET_LEN;

  return {
    x: sim.posX + Math.sin(angle) * BOOM_OFFSET + Math.cos(angle) * reach,
    y: height,
    z: sim.posZ + Math.cos(angle) * BOOM_OFFSET - Math.sin(angle) * reach,
  };
}

export interface DigFeedback {
  inDigZone: boolean;
  inDumpZone: boolean;
  tipOnGround: boolean;
  bucketCurled: boolean;
  canLoad: boolean;
  digging: boolean;
  groundDepth: number;
}

export function createDigFeedback(): DigFeedback {
  return {
    inDigZone: false,
    inDumpZone: false,
    tipOnGround: false,
    bucketCurled: false,
    canLoad: false,
    digging: false,
    groundDepth: 0,
  };
}
