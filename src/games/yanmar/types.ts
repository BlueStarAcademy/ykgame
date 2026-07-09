export type CameraMode = 1 | 2 | 3;

export interface ExcavatorSimState {
  swing: number;
  boom: number;
  arm: number;
  bucket: number;
  posX: number;
  posZ: number;
  heading: number;
  bucketLoad: number;
}

export interface DumpScorePopup {
  id: number;
  score: number;
  critical: boolean;
  rewardText?: string;
  x: number;
  y: number;
  z: number;
}

export interface SavedArmPose {
  boom: number;
  arm: number;
  bucket: number;
}

export interface AutoPoseState {
  saved: SavedArmPose | null;
  executing: boolean;
}

export interface DumpScorePanelState {
  totalScore: number;
  critical: boolean;
  rewardText: string;
  earnedStars: number;
  pendingRewards: number;
  pulseKey: number;
}

export interface CouponDiscoveryState {
  couponType: "YK_PARTS_DISCOUNT" | "EQUIPMENT_RENTAL_DISCOUNT";
  discountPct: number;
  pulseKey: number;
}
