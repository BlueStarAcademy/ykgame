export type CameraMode = 1 | 2 | 3;

/** Drag free-look offsets applied around the default chase look-at. */
export interface CameraLookOffset {
  yaw: number;
  pitch: number;
  /** Orbit distance scale (1 = default). Pinch/zoom adjusts this. */
  distance: number;
}

export type AttachmentType = "bucket" | "breaker" | "grapple";

export interface ExcavatorSimState {
  swing: number;
  boom: number;
  arm: number;
  bucket: number;
  posX: number;
  /** Vertical offset from the core worksite ground plane. */
  posY: number;
  posZ: number;
  heading: number;
  bucketLoad: number;
  attachmentType: AttachmentType;
  carriedBoulderId: string | null;
}

export interface AttachmentWarning {
  key: number;
  message: string;
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

export const AUTO_POSE_SLOT_COUNT = 4;
export type AutoPoseSlotIndex = 0 | 1 | 2 | 3;

export type AutoPoseJoint = "arm" | "boom" | "bucket";

export interface AutoPoseState {
  /** 저장 슬롯 (최대 4개) */
  slots: [
    SavedArmPose | null,
    SavedArmPose | null,
    SavedArmPose | null,
    SavedArmPose | null,
  ];
  /** 실행 중인 슬롯 (실행 시작 시 설정) */
  activeSlot: AutoPoseSlotIndex;
  /** 현재 실행 대상 자세 (= slots[activeSlot]) */
  saved: SavedArmPose | null;
  executing: boolean;
  /** 암 → 붐 → 버킷 순차 실행 인덱스 (0~2). 완료 시 null */
  phase: 0 | 1 | 2 | null;
}

export interface DumpScorePanelState {
  totalScore: number;
  critical: boolean;
  rewardText: string;
  earnedStars: number;
  earnedXp: number;
  pendingRewards: number;
  pulseKey: number;
}

export interface CouponDiscoveryState {
  couponType: "YK_PARTS_DISCOUNT" | "EQUIPMENT_RENTAL_DISCOUNT" | "FILTER_SET_EXCHANGE";
  discountPct: number;
  pulseKey: number;
}
