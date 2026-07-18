export type {
  MonumentPhase,
  MonumentUpgradeKey,
  MonumentQuestMetric,
} from "./types";
export {
  MONUMENT_UNLOCK_LEVEL,
  MONUMENT_CONSTRUCTION_MS,
  MONUMENT_BASE_STORAGE,
  MONUMENT_BASE_INTERVAL_MS,
  MONUMENT_STARS_PER_TICK,
} from "./types";
export {
  MONUMENT_SIGN,
  MONUMENT_POINTS_ICON,
  MONUMENT_UPGRADES,
  MONUMENT_BUILD_QUESTS,
  MONUMENT_SHOP_ITEMS,
  isMonumentUpgradeKey,
  getMonumentUpgradeMaxLevel,
} from "./catalog";
export {
  getMonumentUpgradeCost,
  monumentStorageCap,
  monumentIntervalMs,
  computeProducedStars,
} from "./economy";
export {
  settleMonumentPendingUpgrades,
  findMonumentPending,
  syncMonumentProduction,
  syncMonumentPhase,
} from "./pending";
export {
  loadMonumentQuestState,
  saveMonumentQuestState,
  pushMonumentQuestProgress,
  markMonumentDailyClaimed,
  areBuildQuestsComplete,
  isInMonumentRange,
  createMonumentQuestState,
  type MonumentQuestState,
  type MonumentQuestProgressItem,
} from "./questState";
