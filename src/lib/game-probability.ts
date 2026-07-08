import {
  YANMAR_EQUIPMENT_CONFIG,
  YANMAR_REWARD_CONFIG,
  YANMAR_EQUIPMENT_RESET_REFUND_RATE,
  formatYanmarUpgradeCostSequence,
  type YanmarEquipmentPart,
} from "@/games/yanmar/equipment";

const PARTS_DISCOUNTS = [10, 15, 20] as const;
const RENTAL_DISCOUNTS = [10, 20, 30] as const;

function pct(value: number, digits = 2) {
  return `${(value * 100).toFixed(digits)}%`;
}

function pctPoint(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%p`;
}

export function getGameProbabilityReport() {
  const partsChance = YANMAR_REWARD_CONFIG.partsCouponChance;
  const rentalChance = YANMAR_REWARD_CONFIG.rentalCouponChance;
  const starChance = 1 - partsChance - rentalChance;

  return {
    yanmar: {
      title: "얀마 굴착기 — 하역 보상",
      sections: [
        {
          title: "기본 점수",
          items: [
            { label: "점수 청크 단위", value: `${YANMAR_REWARD_CONFIG.scoreChunkUnits} 적재량` },
            { label: "청크당 기본 점수", value: `${YANMAR_REWARD_CONFIG.baseScorePerChunk}점` },
            { label: "기본 크리티컬 확률", value: pct(YANMAR_REWARD_CONFIG.baseCriticalChance) },
            { label: "기본 크리티컬 배율", value: `×${YANMAR_REWARD_CONFIG.baseCriticalMultiplier}` },
          ],
        },
        {
          title: "하역 보상 확률 (1회 롤)",
          items: [
            {
              label: "YK건기 부품 할인 쿠폰",
              value: pct(partsChance),
              detail: `할인율 ${PARTS_DISCOUNTS.join("% / ")}% 중 랜덤`,
            },
            {
              label: "중장비 대여 할인 쿠폰",
              value: pct(rentalChance),
              detail: `할인율 ${RENTAL_DISCOUNTS.join("% / ")}% 중 랜덤`,
            },
            {
              label: "스타 보상",
              value: pct(starChance),
              detail: `${YANMAR_REWARD_CONFIG.minStarReward}~${YANMAR_REWARD_CONFIG.maxStarReward} 스타 랜덤`,
            },
            {
              label: "쿠폰 유효기간",
              value: `${YANMAR_REWARD_CONFIG.couponExpiresInDays}일`,
            },
          ],
        },
        {
          title: "장비강화 효과",
          items: (Object.keys(YANMAR_EQUIPMENT_CONFIG) as YanmarEquipmentPart[]).map(
            (part) => {
              const config = YANMAR_EQUIPMENT_CONFIG[part];
              const maxEffect =
                part === "ARM"
                  ? pctPoint(config.effectPerLevel * config.maxLevel)
                  : part === "BOOM"
                    ? `+${(config.effectPerLevel * config.maxLevel * 100).toFixed(0)}%`
                    : part === "BUCKET"
                      ? `+${config.effectPerLevel * config.maxLevel}`
                      : `+${(config.effectPerLevel * config.maxLevel * 100).toFixed(0)}%`;
              return {
                label: `${config.label} (+${config.maxLevel} 최대)`,
                value: config.description,
                detail: `최대 누적 ${maxEffect} · 강화 비용 ${formatYanmarUpgradeCostSequence(part, config.maxLevel)} 스타`,
              };
            },
          ),
        },
        {
          title: "강화 비용 공식",
          items: [
            {
              label: "암 / 붐",
              value: "고정 비용표",
              detail: formatYanmarUpgradeCostSequence("ARM", YANMAR_EQUIPMENT_CONFIG.ARM.maxLevel),
            },
            {
              label: "버켓 / 엔진",
              value: "고정 비용표",
              detail: formatYanmarUpgradeCostSequence(
                "BUCKET",
                YANMAR_EQUIPMENT_CONFIG.BUCKET.maxLevel,
              ),
            },
            {
              label: "강화 초기화",
              value: `사용 스타의 ${Math.round(YANMAR_EQUIPMENT_RESET_REFUND_RATE * 100)}% 환급`,
            },
            { label: "기본 최대 적재량", value: `${YANMAR_REWARD_CONFIG.baseMaxLoadUnits}` },
          ],
        },
      ],
    },
  };
}
