import {
  YANMAR_EQUIPMENT_CONFIG,
  YANMAR_REWARD_CONFIG,
  YANMAR_CRASH_REWARD_CONFIG,
  YANMAR_HILL_REWARD_CONFIG,
  YANMAR_EQUIPMENT_RESET_REFUND_RATE,
  YANMAR_UNIFIED_UPGRADE_COSTS,
  YANMAR_UPGRADE_ATTEMPT,
  YANMAR_UPGRADE_BONUSES,
  YANMAR_BASE_HILL_SAFE_LOAD_CHANCE,
  formatYanmarUpgradeCostSequence,
  formatYanmarBreakerDamage,
  formatYanmarSuccessRate,
  getYanmarGripAdhesionBonus,
  getYanmarHaulTruckCooldownSec,
  getYanmarHillSafeLoadChance,
  getYanmarTruckCapacityUnits,
  getYanmarTruckCooldownSec,
  sumUpgradeBonuses,
  type YanmarEquipmentPart,
} from "@/games/yanmar/equipment";
import {
  DUMP_TRUCK_ARRIVE_DURATION_SEC,
  DUMP_TRUCK_DEPART_DURATION_SEC,
  DUMP_TRUCK_ENGINE_START_DURATION_SEC,
} from "@/games/yanmar/dumpTruckState";

const PARTS_DISCOUNTS = [10, 15, 20] as const;
const RENTAL_DISCOUNTS = [10, 20, 30] as const;

function pct(value: number, digits = 2) {
  return `${(value * 100).toFixed(digits)}%`;
}

function pctFromFraction(value: number, digits = 5) {
  return `${(value * 100).toFixed(digits)}%`;
}

function pctPoint(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%p`;
}

export function getGameProbabilityReport() {
  const couponDropChance = YANMAR_REWARD_CONFIG.couponDropChance;
  const couponTypeWeights = YANMAR_REWARD_CONFIG.couponTypeWeights;
  const couponTypeWeightTotal =
    couponTypeWeights.FILTER_SET_EXCHANGE +
    couponTypeWeights.YK_PARTS_DISCOUNT +
    couponTypeWeights.EQUIPMENT_RENTAL_DISCOUNT;
  const couponTypeShare = (weight: number) =>
    couponTypeWeightTotal > 0 ? weight / couponTypeWeightTotal : 0;
  const sharedDropRewardItems = [
    {
      label: "스타 보상",
      value: "100%",
      detail: `항상 지급 · 하역 ${YANMAR_REWARD_CONFIG.minStarReward}~${YANMAR_REWARD_CONFIG.maxStarReward} 스타 랜덤`,
    },
    {
      label: "쿠폰 추가 드롭",
      value: pctFromFraction(couponDropChance),
      detail: "스타와 독립 · 드롭 성공 시 종류는 아래 가중치로 선택",
    },
    {
      label: "필터세트 교환쿠폰",
      value: pctFromFraction(
        couponDropChance *
          couponTypeShare(couponTypeWeights.FILTER_SET_EXCHANGE),
      ),
      detail: `상대 가중치 ${couponTypeWeights.FILTER_SET_EXCHANGE} · 쿠폰 드롭 시 약 ${pctFromFraction(couponTypeShare(couponTypeWeights.FILTER_SET_EXCHANGE), 2)} · 시즌 한도 ${YANMAR_REWARD_CONFIG.filterSetCouponSeasonLimit}장`,
    },
    {
      label: "YK건기 부품 할인 쿠폰",
      value: pctFromFraction(
        couponDropChance * couponTypeShare(couponTypeWeights.YK_PARTS_DISCOUNT),
      ),
      detail: `상대 가중치 ${couponTypeWeights.YK_PARTS_DISCOUNT} · 쿠폰 드롭 시 약 ${pctFromFraction(couponTypeShare(couponTypeWeights.YK_PARTS_DISCOUNT), 2)} · 할인율 ${PARTS_DISCOUNTS.join("% / ")}% 중 랜덤 · 시즌 한도 ${YANMAR_REWARD_CONFIG.partsCouponSeasonLimit}장`,
    },
    {
      label: "중장비 대여 할인 쿠폰",
      value: pctFromFraction(
        couponDropChance *
          couponTypeShare(couponTypeWeights.EQUIPMENT_RENTAL_DISCOUNT),
      ),
      detail: `상대 가중치 ${couponTypeWeights.EQUIPMENT_RENTAL_DISCOUNT} · 쿠폰 드롭 시 약 ${pctFromFraction(couponTypeShare(couponTypeWeights.EQUIPMENT_RENTAL_DISCOUNT), 2)} · 할인율 ${RENTAL_DISCOUNTS.join("% / ")}% 중 랜덤 · 시즌 한도 ${YANMAR_REWARD_CONFIG.rentalCouponSeasonLimit}장`,
    },
    {
      label: "쿠폰 유효기간",
      value: `${YANMAR_REWARD_CONFIG.couponExpiresInDays}일`,
    },
    {
      label: "시즌 쿠폰 한도",
      value: "종류별 고정",
      detail:
        "시즌이 바뀌면 한도가 다시 채워집니다. 한도 소진 시 쿠폰만 생략되며 스타는 이미 지급됩니다.",
    },
    {
      label: "적용 구역",
      value: "흙 하역 · 아스팔트 파괴 · 돌 트럭 적재/하역",
      detail: "dump / crash / hill 보상 API 공통 드롭 모델",
    },
  ];
  const capacityConfig = YANMAR_EQUIPMENT_CONFIG.TRUCK_CAPACITY;
  const speedConfig = YANMAR_EQUIPMENT_CONFIG.TRUCK_SPEED;
  const maxTruckCapacity = getYanmarTruckCapacityUnits(capacityConfig.maxLevel);
  const minTruckCooldown = getYanmarTruckCooldownSec(speedConfig.maxLevel);
  const truckCapacityRows = Array.from(
    { length: capacityConfig.maxLevel + 1 },
    (_, level) => ({
      level: `+${level}`,
      value: `${getYanmarTruckCapacityUnits(level).toLocaleString()}`,
    }),
  );
  const truckSpeedRows = Array.from(
    { length: speedConfig.maxLevel + 1 },
    (_, level) => ({
      level: `+${level}`,
      value: `${getYanmarTruckCooldownSec(level).toFixed(0)}초`,
    }),
  );
  const truckCostRows = YANMAR_UNIFIED_UPGRADE_COSTS.map((cost, index) => ({
    level: `+${index} → +${index + 1}`,
    value: `${cost.toLocaleString()} 스타`,
  }));
  const upgradeRateRows = YANMAR_UPGRADE_ATTEMPT.map((attempt, index) => ({
    level: `+${index} → +${index + 1}`,
    value: `${formatYanmarSuccessRate(attempt.successRate)}${
      attempt.failBonus > 0
        ? ` · 실패 시 +${formatYanmarSuccessRate(attempt.failBonus)}`
        : ""
    }`,
  }));

  return {
    yanmar: {
      title: "얀마 굴착기 — 하역 보상",
      sections: [
        {
          title: "기본 점수",
          items: [
            { label: "점수 청크 단위", value: `${YANMAR_REWARD_CONFIG.scoreChunkUnits} 적재량` },
            { label: "청크당 기본 점수", value: `${YANMAR_REWARD_CONFIG.baseScorePerChunkMin}~${YANMAR_REWARD_CONFIG.baseScorePerChunkMax}점 (랜덤)` },
            { label: "기본 크리티컬 확률", value: pct(YANMAR_REWARD_CONFIG.baseCriticalChance) },
            { label: "기본 크리티컬 배율", value: `×${YANMAR_REWARD_CONFIG.baseCriticalMultiplier}` },
          ],
        },
        {
          title: "하역·파괴·돌 하역 보상 확률 (1회 롤)",
          items: sharedDropRewardItems,
        },
        {
          title: "Crash 아스팔트 파괴 보상 (타일 1개)",
          items: [
            {
              label: "기본 점수",
              value: `${YANMAR_CRASH_REWARD_CONFIG.baseScoreMin}~${YANMAR_CRASH_REWARD_CONFIG.baseScoreMax}점 (랜덤)`,
              detail: "암/붐 강화의 크리티컬 확률·배율 적용",
            },
            {
              label: "기본 크리티컬 확률",
              value: pct(YANMAR_REWARD_CONFIG.baseCriticalChance),
            },
            {
              label: "기본 크리티컬 배율",
              value: `×${YANMAR_REWARD_CONFIG.baseCriticalMultiplier}`,
            },
            {
              label: "스타 보상",
              value: "100%",
              detail: `${YANMAR_CRASH_REWARD_CONFIG.minStarReward}~${YANMAR_CRASH_REWARD_CONFIG.maxStarReward} 스타 랜덤 · 항상 지급`,
            },
            {
              label: "쿠폰 추가 드롭",
              value: pctFromFraction(couponDropChance),
              detail: "하역과 동일 · 스타와 독립적인 추가 드롭",
            },
            {
              label: "경험치",
              value: `${YANMAR_CRASH_REWARD_CONFIG.xpReward.toLocaleString()} XP`,
            },
            {
              label: "구역 재생성",
              value: "9칸 전부 파괴 후 5분",
              detail: "같은 자리에 아스팔트 9칸 일괄 리젠",
            },
          ],
        },
        {
          title: "Hill 돌 운반 보상 (돌 1개 트럭 적재)",
          items: [
            {
              label: "기본 점수",
              value: `${YANMAR_HILL_REWARD_CONFIG.baseScoreMin}~${YANMAR_HILL_REWARD_CONFIG.baseScoreMax}점 (랜덤)`,
              detail: "암/붐 강화의 크리티컬 확률·배율 적용",
            },
            {
              label: "경험치",
              value: `${YANMAR_HILL_REWARD_CONFIG.xpMin}~${YANMAR_HILL_REWARD_CONFIG.xpMax} XP (랜덤)`,
            },
            {
              label: "스타 보상",
              value: "100%",
              detail: `${YANMAR_HILL_REWARD_CONFIG.minStarReward}~${YANMAR_HILL_REWARD_CONFIG.maxStarReward} 스타 랜덤 · 항상 지급`,
            },
            {
              label: "쿠폰 추가 드롭",
              value: pctFromFraction(couponDropChance),
              detail: "하역과 동일 · 스타와 독립적인 추가 드롭",
            },
            {
              label: "구역 규칙",
              value: "돌 5개 · 트럭 적재 5개 · 리젠 300초",
              detail: "안전적재 강화로 적재 실패 시 재적재 확률 증가 · 돌트럭속도 강화로 복귀 단축",
            },
          ],
        },
        {
          title: "덤프트럭 하역 시스템",
          items: [
            {
              label: "동작 흐름",
              value: "적재 → 만차 → 출발 → 대기 → 도착",
              detail: `만차 시 하역 불가 · 시동 ${DUMP_TRUCK_ENGINE_START_DURATION_SEC}초 · 출발 ${DUMP_TRUCK_DEPART_DURATION_SEC}초 · 복귀 ${DUMP_TRUCK_ARRIVE_DURATION_SEC}초`,
            },
            {
              label: "기본 최대 하역량",
              value: `${YANMAR_REWARD_CONFIG.baseTruckCapacityUnits.toLocaleString()}`,
              detail: `강화 최대 +${sumUpgradeBonuses(YANMAR_UPGRADE_BONUSES.TRUCK_CAPACITY, capacityConfig.maxLevel)} → ${maxTruckCapacity.toLocaleString()}`,
            },
            {
              label: "기본 재도착 대기",
              value: `${YANMAR_REWARD_CONFIG.baseTruckCooldownSec}초`,
              detail: `속도 강화 최소 ${minTruckCooldown.toFixed(0)}초 (초 단위 누적 단축)`,
            },
            {
              label: "하역량 강화",
              value: `+0 ~ +${capacityConfig.maxLevel}`,
              table: {
                columns: ["레벨", "하역량"],
                rows: truckCapacityRows,
              },
            },
            {
              label: "속도 강화",
              value: `+0 ~ +${speedConfig.maxLevel}`,
              table: {
                columns: ["레벨", "재도착"],
                rows: truckSpeedRows,
              },
            },
            {
              label: "강화 비용",
              value: "고정 비용표",
              table: {
                columns: ["단계", "비용"],
                rows: truckCostRows,
              },
            },
          ],
        },
        {
          title: "장비강화 효과",
          items: (Object.keys(YANMAR_EQUIPMENT_CONFIG) as YanmarEquipmentPart[]).map(
            (part) => {
              const config = YANMAR_EQUIPMENT_CONFIG[part];
              const maxEffect =
                part === "TRUCK_CAPACITY"
                  ? `+${sumUpgradeBonuses(YANMAR_UPGRADE_BONUSES.TRUCK_CAPACITY, config.maxLevel)}`
                  : part === "TRUCK_SPEED"
                    ? `${getYanmarTruckCooldownSec(0).toFixed(0)}초 → ${getYanmarTruckCooldownSec(config.maxLevel).toFixed(0)}초`
                    : part === "CRASH_RESPAWN"
                      ? `${formatYanmarBreakerDamage(0)} → ${formatYanmarBreakerDamage(config.maxLevel)}`
                      : part === "GRAPPLE_ADHESION"
                        ? `+${Math.round(getYanmarGripAdhesionBonus(config.maxLevel) * 100)}%`
                      : part === "HAUL_TRUCK_SPEED"
                        ? `${getYanmarHaulTruckCooldownSec(0)}초 → ${Math.round(getYanmarHaulTruckCooldownSec(config.maxLevel))}초`
                      : part === "HILL_SAFE_LOAD"
                        ? `${Math.round(YANMAR_BASE_HILL_SAFE_LOAD_CHANCE * 100)}% → ${Math.round(getYanmarHillSafeLoadChance(config.maxLevel) * 100)}%`
                    : part === "ARM"
                      ? pctPoint(sumUpgradeBonuses(YANMAR_UPGRADE_BONUSES.ARM, config.maxLevel))
                      : part === "BOOM"
                        ? `+${(sumUpgradeBonuses(YANMAR_UPGRADE_BONUSES.BOOM, config.maxLevel) * 100).toFixed(0)}%`
                        : part === "BUCKET"
                          ? `+${sumUpgradeBonuses(YANMAR_UPGRADE_BONUSES.BUCKET, config.maxLevel)}`
                          : `+${(sumUpgradeBonuses(YANMAR_UPGRADE_BONUSES.ENGINE, config.maxLevel) * 100).toFixed(0)}%`;
              return {
                label: `${config.label} (+${config.maxLevel} 최대)`,
                value: config.description,
                detail: `최대 누적 ${maxEffect} · 강화 비용 ${formatYanmarUpgradeCostSequence(part, config.maxLevel)} 스타`,
              };
            },
          ),
        },
        {
          title: "강화 성공·실패",
          items: [
            {
              label: "공통 성공률",
              value: "단계별 고정",
              table: {
                columns: ["단계", "성공률"],
                rows: upgradeRateRows,
              },
            },
            {
              label: "실패 보너스",
              value: "같은 단계 재도전 누적",
              detail: "성공 또는 초기화 시 보너스 초기화 · 스타는 실패해도 소모",
            },
          ],
        },
        {
          title: "강화 비용 공식",
          items: [
            {
              label: "모든 부위",
              value: "통일 비용표",
              detail: YANMAR_UNIFIED_UPGRADE_COSTS.join(" / "),
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
