export type WorkshopId = "dump" | "crash" | "hill";

export type WorkshopUpgradeKey =
  | "truck_capacity"
  | "truck_cooldown"
  | "breaker_power"
  | "score_rank"
  | "xp_expert"
  | "lucky_drop"
  | "rock_appraiser"
  | "haul_capacity"
  | "haul_cooldown";

export type WorkshopShopItemId =
  | "ticket_standard"
  | "ticket_premium"
  | "enhance_core";

export type WorkshopQuestKind = "daily" | "repeat";

export type WorkshopQuestMetric =
  | "soilDump"
  | "dumpTruckDepart"
  | "asphaltBreak"
  | "rockDump"
  | "haulTruckDepart";

export interface WorkshopUpgradeDef {
  key: WorkshopUpgradeKey;
  label: string;
  description: string;
  maxLevel: number;
}

export interface WorkshopShopItemDef {
  id: WorkshopShopItemId;
  label: string;
  description: string;
  cost: number;
  weeklyLimit: number;
  icon: string;
}

export interface WorkshopQuestDef {
  id: string;
  kind: WorkshopQuestKind;
  title: string;
  metric: WorkshopQuestMetric;
  target: number;
  rewardPoints: number;
}

export interface WorkshopSignDef {
  x: number;
  z: number;
  radius: number;
  rotationY: number;
}

export interface WorkshopDef {
  id: WorkshopId;
  label: string;
  pointsLabel: string;
  /** Workshop-specific point coin icon */
  pointsIcon: string;
  /** Map tier required (1=always, 2=crash, 3=hill). */
  minMapTier: number;
  sign: WorkshopSignDef;
  promptTitle: string;
  promptAction: string;
  upgrades: readonly WorkshopUpgradeDef[];
  quests: readonly WorkshopQuestDef[];
}
