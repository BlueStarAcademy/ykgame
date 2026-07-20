import {
  WORKSHOP_SHOP_PRICES,
  WORKSHOP_SHOP_WEEKLY_LIMIT,
} from "./economy";
import type {
  WorkshopDef,
  WorkshopId,
  WorkshopShopItemDef,
  WorkshopUpgradeKey,
} from "./types";
import { DUMP_ZONE } from "../terrain";
import { SITE_LAYOUT } from "../siteLayout";

export const WORKSHOP_SHOP_ITEMS: readonly WorkshopShopItemDef[] = [
  {
    id: "ticket_standard",
    label: "일반 뽑기권",
    description: "일반 뽑기 1회에 사용",
    cost: WORKSHOP_SHOP_PRICES.ticket_standard,
    weeklyLimit: WORKSHOP_SHOP_WEEKLY_LIMIT,
    icon: "/images/yanmar/2d/gacha-ticket-standard.svg",
  },
  {
    id: "ticket_premium",
    label: "고급 뽑기권",
    description: "고급 뽑기 1회에 사용",
    cost: WORKSHOP_SHOP_PRICES.ticket_premium,
    weeklyLimit: WORKSHOP_SHOP_WEEKLY_LIMIT,
    icon: "/images/yanmar/2d/gacha-ticket-premium.svg",
  },
  {
    id: "enhance_core",
    label: "강화코어",
    description: "장비 강화에 사용",
    cost: WORKSHOP_SHOP_PRICES.enhance_core,
    weeklyLimit: WORKSHOP_SHOP_WEEKLY_LIMIT,
    icon: "/images/yanmar/2d/enhance-core.svg",
  },
] as const;

const DUMP_UPGRADES = [
  {
    key: "truck_capacity" as const,
    label: "덤프 적재량",
    description: "덤프트럭 최대 하역량 증가",
    maxLevel: 10,
  },
  {
    key: "truck_cooldown" as const,
    label: "덤프 복귀시간",
    description: "덤프트럭 복귀 대기시간 감소",
    maxLevel: 10,
  },
  {
    key: "lucky_drop" as const,
    label: "행운의 작업자",
    description: "장비 획득 확률 +1%p",
    maxLevel: 10,
  },
];

const CRASH_UPGRADES = [
  {
    key: "breaker_power" as const,
    label: "브레이커 파워",
    description: "브레이커 데미지 +10%",
    maxLevel: 10,
  },
  {
    key: "score_rank" as const,
    label: "브레이커 랭커",
    description: "작업 완료 점수 +10%",
    maxLevel: 10,
  },
  {
    key: "xp_expert" as const,
    label: "브레이커 숙련자",
    description: "작업 완료 경험치 +5%",
    maxLevel: 10,
  },
  {
    key: "lucky_drop" as const,
    label: "행운의 작업자",
    description: "장비 획득 확률 +1%p",
    maxLevel: 10,
  },
];

const HILL_UPGRADES = [
  {
    key: "haul_capacity" as const,
    label: "돌트럭 적재량",
    description: "돌 트럭 적재 한도 +1",
    maxLevel: 10,
  },
  {
    key: "haul_cooldown" as const,
    label: "돌트럭 복귀시간",
    description: "돌 트럭 복귀 대기시간 감소",
    maxLevel: 10,
  },
  {
    key: "score_rank" as const,
    label: "돌운반 랭커",
    description: "돌 하역 점수 +10%",
    maxLevel: 10,
  },
  {
    key: "xp_expert" as const,
    label: "돌운반 숙련자",
    description: "돌 하역 경험치 +5%",
    maxLevel: 10,
  },
  {
    key: "lucky_drop" as const,
    label: "행운의 작업자",
    description: "장비 획득 확률 +1%p",
    maxLevel: 10,
  },
  {
    key: "rock_appraiser" as const,
    label: "돌 감정사",
    description: "돌 지역 돌 +1개",
    maxLevel: 5,
  },
];

export const WORKSHOP_DEFS: Record<WorkshopId, WorkshopDef> = {
  dump: {
    id: "dump",
    label: "흙 하역장",
    pointsLabel: "하역장 포인트",
    pointsIcon: "/images/yanmar/2d/workshop-coin-dump.svg",
    minMapTier: 1,
    sign: {
      x: DUMP_ZONE.x - 8,
      z: DUMP_ZONE.z + 6,
      radius: 18,
      rotationY: Math.PI * 0.15,
    },
    promptTitle: "흙 하역장",
    promptAction: "관리하기",
    upgrades: DUMP_UPGRADES,
    quests: [
      {
        id: "dump-daily-soil-8000",
        kind: "daily",
        title: "흙 하역 8,000",
        metric: "soilDump",
        target: 8000,
        rewardPoints: 35,
      },
      {
        id: "dump-daily-truck-2",
        kind: "daily",
        title: "덤프트럭 출발 2회",
        metric: "dumpTruckDepart",
        target: 2,
        rewardPoints: 35,
      },
      {
        id: "dump-repeat-soil-4000",
        kind: "repeat",
        title: "흙 하역 4,000",
        metric: "soilDump",
        target: 4000,
        rewardPoints: 15,
      },
      {
        id: "dump-repeat-truck-1",
        kind: "repeat",
        title: "덤프트럭 출발 1회",
        metric: "dumpTruckDepart",
        target: 1,
        rewardPoints: 20,
      },
    ],
  },
  crash: {
    id: "crash",
    label: "브레이커 작업장",
    pointsLabel: "브레이커 포인트",
    pointsIcon: "/images/yanmar/2d/workshop-coin-crash.svg",
    minMapTier: 2,
    sign: {
      x: SITE_LAYOUT.crash[0] - 14,
      z: SITE_LAYOUT.crash[1] + 10,
      radius: 18,
      rotationY: -Math.PI * 0.2,
    },
    promptTitle: "브레이커 작업장",
    promptAction: "관리하기",
    upgrades: CRASH_UPGRADES,
    quests: [
      {
        id: "crash-daily-asphalt-9",
        kind: "daily",
        title: "아스팔트 9개 파괴",
        metric: "asphaltBreak",
        target: 9,
        rewardPoints: 40,
      },
      {
        id: "crash-daily-asphalt-18",
        kind: "daily",
        title: "아스팔트 18개 파괴",
        metric: "asphaltBreak",
        target: 18,
        rewardPoints: 30,
      },
      {
        id: "crash-repeat-asphalt-3",
        kind: "repeat",
        title: "아스팔트 3개 파괴",
        metric: "asphaltBreak",
        target: 3,
        rewardPoints: 12,
      },
      {
        id: "crash-repeat-asphalt-6",
        kind: "repeat",
        title: "아스팔트 6개 파괴",
        metric: "asphaltBreak",
        target: 6,
        rewardPoints: 18,
      },
    ],
  },
  hill: {
    id: "hill",
    label: "돌 하역장",
    pointsLabel: "돌 하역장 포인트",
    pointsIcon: "/images/yanmar/2d/workshop-coin-hill.svg",
    minMapTier: 3,
    sign: {
      // Keep clear of the haul-truck ↔ stone-zone dump path (truck is SE at 42,100).
      x: SITE_LAYOUT.hill[0] - 18,
      z: SITE_LAYOUT.hill[1] + 10,
      radius: 18,
      rotationY: Math.PI * 0.65,
    },
    promptTitle: "돌 하역장",
    promptAction: "관리하기",
    upgrades: HILL_UPGRADES,
    quests: [
      {
        id: "hill-daily-rock-5",
        kind: "daily",
        title: "돌 하역 5개",
        metric: "rockDump",
        target: 5,
        rewardPoints: 40,
      },
      {
        id: "hill-daily-haul-1",
        kind: "daily",
        title: "운반트럭 출발 1회",
        metric: "haulTruckDepart",
        target: 1,
        rewardPoints: 30,
      },
      {
        id: "hill-repeat-rock-2",
        kind: "repeat",
        title: "돌 하역 2개",
        metric: "rockDump",
        target: 2,
        rewardPoints: 15,
      },
      {
        id: "hill-repeat-rock-3",
        kind: "repeat",
        title: "돌 하역 3개",
        metric: "rockDump",
        target: 3,
        rewardPoints: 20,
      },
    ],
  },
};

export const WORKSHOP_IDS: WorkshopId[] = ["dump", "crash", "hill"];

export function getWorkshopDef(id: WorkshopId): WorkshopDef {
  return WORKSHOP_DEFS[id];
}

export function isWorkshopId(value: unknown): value is WorkshopId {
  return value === "dump" || value === "crash" || value === "hill";
}

export function isValidUpgradeKey(
  workshopId: WorkshopId,
  key: string,
): key is WorkshopUpgradeKey {
  return WORKSHOP_DEFS[workshopId].upgrades.some((u) => u.key === key);
}

export function workshopPointsField(
  workshopId: WorkshopId,
): "dumpWorkshopPoints" | "crashWorkshopPoints" | "hillWorkshopPoints" {
  if (workshopId === "dump") return "dumpWorkshopPoints";
  if (workshopId === "crash") return "crashWorkshopPoints";
  return "hillWorkshopPoints";
}
