export type YanmarCouponType =
  | "YK_PARTS_DISCOUNT"
  | "EQUIPMENT_RENTAL_DISCOUNT"
  | "FILTER_SET_EXCHANGE";

export const YANMAR_COUPON_VISUALS: Record<
  YanmarCouponType,
  { label: string; image: string; accent: string }
> = {
  YK_PARTS_DISCOUNT: {
    label: "YK건기 부품 할인권",
    image: "/images/coupon-yk-parts.svg",
    accent: "#f59e0b",
  },
  EQUIPMENT_RENTAL_DISCOUNT: {
    label: "중장비 대여 할인권",
    image: "/images/coupon-equipment-rental.svg",
    accent: "#38bdf8",
  },
  FILTER_SET_EXCHANGE: {
    label: "필터세트 교환쿠폰",
    image: "/images/coupon-filter-set.svg",
    accent: "#22c55e",
  },
};

export function getYanmarCouponLabel(type: YanmarCouponType) {
  return YANMAR_COUPON_VISUALS[type].label;
}

export function getYanmarCouponImage(type: YanmarCouponType) {
  return YANMAR_COUPON_VISUALS[type].image;
}
