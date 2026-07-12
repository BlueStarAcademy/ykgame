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
  priceStars: number;
  imageSrc: string;
};

export const SHOP_ITEMS: readonly ShopItem[] = [
  {
    id: "cylinder-oil-arm",
    name: "실린더오일(암)",
    effect: "크리티컬 확률 25% 증가",
    durationLabel: "1시간",
    priceStars: 50,
    imageSrc: "/images/yanmar/2d/shop/shop-oil-arm.png",
  },
  {
    id: "cylinder-oil-boom",
    name: "실린더오일(붐)",
    effect: "크리티컬 점수 50% 증가",
    durationLabel: "1시간",
    priceStars: 50,
    imageSrc: "/images/yanmar/2d/shop/shop-oil-boom.png",
  },
  {
    id: "engine-fluorine-clean",
    name: "엔진불소제거",
    effect: "(주행) 이동속도 50% 증가",
    durationLabel: "1시간",
    priceStars: 50,
    imageSrc: "/images/yanmar/2d/shop/shop-engine-cleaner.png",
  },
  {
    id: "rock-load-manual",
    name: "돌적재교본",
    effect: "돌 적재시 밀착감 20% 증가",
    durationLabel: "1시간",
    priceStars: 50,
    imageSrc: "/images/yanmar/2d/shop/shop-rock-manual.png",
  },
  {
    id: "truck-racer",
    name: "트럭레이서",
    effect: "덤프트럭·돌트럭 복귀시간 60초 감소",
    durationLabel: "1시간",
    priceStars: 50,
    imageSrc: "/images/yanmar/2d/shop/shop-truck-racer.png",
  },
  {
    id: "ranker-will",
    name: "랭커의의지",
    effect: "점수 획득 시 35% 확률로 점수 2배",
    durationLabel: "1시간",
    priceStars: 100,
    imageSrc: "/images/yanmar/2d/shop/shop-ranker-will.png",
  },
] as const;
