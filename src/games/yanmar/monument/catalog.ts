import { SITE_LAYOUT } from "../siteLayout";
import { WORKSHOP_SHOP_ITEMS } from "../workshop/catalog";
import {
  WORKSHOP_SHOP_PRICES,
  WORKSHOP_SHOP_WEEKLY_LIMIT,
} from "../workshop/economy";
import {
  MONUMENT_STARS_PER_TICK,
  type MonumentBuildQuestDef,
  type MonumentQuestDef,
  type MonumentUpgradeDef,
  type MonumentUpgradeKey,
} from "./types";

export const MONUMENT_SIGN = {
  x: SITE_LAYOUT.monument[0],
  z: SITE_LAYOUT.monument[1],
  // Keep clear of the haul truck drop (42,100) — was 28 and overlapped dump work.
  radius: 22,
  rotationY: Math.PI,
} as const;

export const MONUMENT_POINTS_ICON =
  "/images/yanmar/2d/workshop-coin-monument.svg";

export const MONUMENT_UPGRADES: readonly MonumentUpgradeDef[] = [
  {
    key: "storage_cap",
    label: "최대 저장량",
    description: "조형물에 쌓을 수 있는 스타 한도 증가",
    maxLevel: 10,
  },
  {
    key: "prod_speed",
    label: "생산 속도",
    description: `스타 ${MONUMENT_STARS_PER_TICK}개 생산에 걸리는 시간 단축`,
    maxLevel: 10,
  },
] as const;

/** Fixed missions required before construction can start. */
export const MONUMENT_BUILD_QUESTS: readonly MonumentBuildQuestDef[] = [
  {
    id: "build-dump-truck",
    title: "덤프트럭 1회 보내기",
    metric: "dumpTruckDepart",
    target: 1,
  },
  {
    id: "build-asphalt-9",
    title: "파쇄 9개",
    metric: "asphaltBreak",
    target: 9,
  },
  {
    id: "build-haul-truck",
    title: "돌 트럭 1회 보내기",
    metric: "haulTruckDepart",
    target: 1,
  },
] as const;

/** Daily random quest pool (rolled client-side like missions). */
export const MONUMENT_QUEST_POOL: readonly Omit<MonumentQuestDef, "id">[] = [
  {
    title: "흙 하역",
    metric: "soilDump",
    target: 2000,
    rewardPoints: 25,
    kind: "daily",
  },
  {
    title: "덤프트럭 보내기",
    metric: "dumpTruckDepart",
    target: 1,
    rewardPoints: 20,
    kind: "daily",
  },
  {
    title: "파쇄",
    metric: "asphaltBreak",
    target: 6,
    rewardPoints: 30,
    kind: "daily",
  },
  {
    title: "돌 트럭 보내기",
    metric: "haulTruckDepart",
    target: 1,
    rewardPoints: 25,
    kind: "daily",
  },
  {
    title: "돌 하역",
    metric: "rockDump",
    target: 3,
    rewardPoints: 30,
    kind: "daily",
  },
  {
    title: "주행 거리",
    metric: "travel",
    target: 500,
    rewardPoints: 15,
    kind: "daily",
  },
];

export const MONUMENT_DAILY_QUEST_COUNT = 3;

/** Random repeat quest pool — rolled on activation and after each claim. */
export const MONUMENT_REPEAT_QUEST_POOL: readonly Omit<
  MonumentQuestDef,
  "id" | "kind"
>[] = [
  {
    title: "흙 하역",
    metric: "soilDump",
    target: 800,
    rewardPoints: 8,
  },
  {
    title: "덤프트럭 보내기",
    metric: "dumpTruckDepart",
    target: 1,
    rewardPoints: 6,
  },
  {
    title: "파쇄",
    metric: "asphaltBreak",
    target: 3,
    rewardPoints: 10,
  },
  {
    title: "돌 트럭 보내기",
    metric: "haulTruckDepart",
    target: 1,
    rewardPoints: 8,
  },
  {
    title: "돌 하역",
    metric: "rockDump",
    target: 2,
    rewardPoints: 10,
  },
  {
    title: "주행 거리",
    metric: "travel",
    target: 300,
    rewardPoints: 5,
  },
];

export const MONUMENT_REPEAT_ACTIVE_COUNT = 1;

export const MONUMENT_SHOP_ITEMS = WORKSHOP_SHOP_ITEMS;
export { WORKSHOP_SHOP_PRICES, WORKSHOP_SHOP_WEEKLY_LIMIT };

export function isMonumentUpgradeKey(key: string): key is MonumentUpgradeKey {
  return key === "storage_cap" || key === "prod_speed";
}

export function getMonumentUpgradeMaxLevel(key: MonumentUpgradeKey): number {
  return MONUMENT_UPGRADES.find((u) => u.key === key)?.maxLevel ?? 10;
}
