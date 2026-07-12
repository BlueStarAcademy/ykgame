export type ShopItemId =
  | "cylinder-oil-arm"
  | "cylinder-oil-boom"
  | "engine-fluorine-clean"
  | "rock-load-manual"
  | "truck-racer"
  | "ranker-will";

export type ShopItem = {
  id: ShopItemId;
  name: string;
  effect: string;
  durationLabel: string;
  durationMs: number;
  priceStars: number;
  imageSrc: string;
};

/** Default shop buff length (matches durationLabel). */
export const SHOP_BUFF_DURATION_MS = 60 * 60 * 1000;

export const SHOP_ITEMS: readonly ShopItem[] = [
  {
    id: "cylinder-oil-arm",
    name: "실린더오일(암)",
    effect: "크리티컬 확률 +25%",
    durationLabel: "지속시간 1시간",
    durationMs: SHOP_BUFF_DURATION_MS,
    priceStars: 50,
    imageSrc: "/images/yanmar/2d/shop/shop-oil-arm.png",
  },
  {
    id: "cylinder-oil-boom",
    name: "실린더오일(붐)",
    effect: "크리티컬 점수 +50%",
    durationLabel: "지속시간 1시간",
    durationMs: SHOP_BUFF_DURATION_MS,
    priceStars: 50,
    imageSrc: "/images/yanmar/2d/shop/shop-oil-boom.png",
  },
  {
    id: "engine-fluorine-clean",
    name: "엔진불소제거",
    effect: "주행속도 +50%",
    durationLabel: "지속시간 1시간",
    durationMs: SHOP_BUFF_DURATION_MS,
    priceStars: 50,
    imageSrc: "/images/yanmar/2d/shop/shop-engine-cleaner.png",
  },
  {
    id: "rock-load-manual",
    name: "돌적재교본",
    effect: "밀착감 +20%",
    durationLabel: "지속시간 1시간",
    durationMs: SHOP_BUFF_DURATION_MS,
    priceStars: 50,
    imageSrc: "/images/yanmar/2d/shop/shop-rock-manual.png",
  },
  {
    id: "truck-racer",
    name: "트럭레이서",
    effect: "트럭복귀시간 -60초",
    durationLabel: "지속시간 1시간",
    durationMs: SHOP_BUFF_DURATION_MS,
    priceStars: 50,
    imageSrc: "/images/yanmar/2d/shop/shop-truck-racer.png",
  },
  {
    id: "ranker-will",
    name: "랭커의의지",
    effect: "점수 2배 확률 35%",
    durationLabel: "지속시간 1시간",
    durationMs: SHOP_BUFF_DURATION_MS,
    priceStars: 100,
    imageSrc: "/images/yanmar/2d/shop/shop-ranker-will.png",
  },
] as const;

export const SHOP_ITEM_BY_ID: Readonly<Record<ShopItemId, ShopItem>> =
  Object.fromEntries(SHOP_ITEMS.map((item) => [item.id, item])) as Record<
    ShopItemId,
    ShopItem
  >;

export function isShopItemId(value: unknown): value is ShopItemId {
  return typeof value === "string" && value in SHOP_ITEM_BY_ID;
}
