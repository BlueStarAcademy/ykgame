import * as THREE from "three";
import {
  getArmCylTipLocal,
  getBoomLiftAnchors,
  getBoomPinAnchors,
  getBucketCylMeetLocal,
  WE,
  type Vec2,
} from "./workEquipmentStructure";
import { YANMAR_MACHINE_RIG } from "../machineVisualTheme";

export function setHydraulicCylinderPose(
  cylinder: THREE.Group | null,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
) {
  if (!cylinder) return;
  const dx = endX - startX;
  const dy = endY - startY;
  cylinder.position.set(startX, startY, 0);
  cylinder.rotation.z = Math.atan2(dy, dx);
  cylinder.userData.pinDistance = Math.hypot(dx, dy);
}

function rotateLocal(p: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: c * p.x - s * p.y, y: s * p.x + c * p.y };
}

/**
 * Pose all three work-equipment cylinders for the current joint state.
 * Parenting must match the scene graph (swing / boom / arm).
 */
export function poseWorkEquipmentCylinders(opts: {
  boomJoint: number;
  armJoint: number;
  bucketJoint: number;
  boomCylinder: THREE.Group | null;
  armCylinder: THREE.Group | null;
  bucketCylinder: THREE.Group | null;
  showBucketCylinder: boolean;
  boomLen?: number;
  armLen?: number;
}) {
  const boomLen = opts.boomLen ?? YANMAR_MACHINE_RIG.boomLength;
  const armLen = opts.armLen ?? YANMAR_MACHINE_RIG.armLength;
  const anchors = getBoomPinAnchors(boomLen);

  // Boom lift: boom frame — rides the lower gooseneck 등 / chassis side.
  const lift = getBoomLiftAnchors(opts.boomJoint, boomLen);
  setHydraulicCylinderPose(
    opts.boomCylinder,
    lift.barrel.x,
    lift.barrel.y,
    lift.rod.x,
    lift.rod.y,
  );

  // Boom cylinder: boom frame only — upper 등 → boom tip (never onto the arm)
  setHydraulicCylinderPose(
    opts.armCylinder,
    anchors.armCylBarrel.x,
    anchors.armCylBarrel.y,
    anchors.armCylRod.x,
    anchors.armCylRod.y,
  );

  // Arm cylinder: locked to arm 등 (+X at armDorsalY) — always parallel to the arm
  if (opts.showBucketCylinder && opts.bucketCylinder) {
    const meet = getBucketCylMeetLocal(boomLen);
    const tip = getArmCylTipLocal(armLen);
    // Follow H-link reach in X only; Y stays on the arm dorsal line.
    const hEnd = rotateLocal(WE.hLinkCylPin, opts.bucketJoint);
    const endX = Math.max(meet.x + 0.4, armLen + hEnd.x);
    setHydraulicCylinderPose(
      opts.bucketCylinder,
      meet.x,
      meet.y,
      endX,
      tip.y,
    );
  }
}
