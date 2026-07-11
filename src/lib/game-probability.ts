import {
  YANMAR_EQUIPMENT_CONFIG,
  YANMAR_REWARD_CONFIG,
  YANMAR_CRASH_REWARD_CONFIG,
  YANMAR_HILL_REWARD_CONFIG,
  YANMAR_EQUIPMENT_RESET_REFUND_RATE,
  YANMAR_SPECIAL_UPGRADE_COSTS,
  YANMAR_TRUCK_UPGRADE_COSTS,
  formatYanmarUpgradeCostSequence,
  getYanmarBreakerDamage,
  getYanmarGripAdhesionBonus,
  getYanmarHaulTruckCooldownSec,
  getYanmarHillBoulderCount,
  getYanmarTruckCapacityUnits,
  getYanmarTruckCooldownSec,
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

function pctPoint(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%p`;
}

export function getGameProbabilityReport() {
  const filterChance = YANMAR_REWARD_CONFIG.filterSetCouponChance;
  const partsChance = YANMAR_REWARD_CONFIG.partsCouponChance;
  const rentalChance = YANMAR_REWARD_CONFIG.rentalCouponChance;
  const starChance = 1 - filterChance - partsChance - rentalChance;
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
  const truckCostRows = YANMAR_TRUCK_UPGRADE_COSTS.map((cost, index) => ({
    level: `+${index} → +${index + 1}`,
    value: `${cost.toLocaleString()} 스타`,
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
          title: "하역 보상 확률 (1회 롤)",
          items: [
            {
              label: "필터세트 교환쿠폰",
              value: pct(filterChance, 4),
              detail: `교환권 · 시즌 한도 ${YANMAR_REWARD_CONFIG.filterSetCouponSeasonLimit}장`,
            },
            {
              label: "YK건기 부품 할인 쿠폰",
              value: pct(partsChance),
              detail: `할인율 ${PARTS_DISCOUNTS.join("% / ")}% 중 랜덤 · 시즌 한도 ${YANMAR_REWARD_CONFIG.partsCouponSeasonLimit}장`,
            },
            {
              label: "중장비 대여 할인 쿠폰",
              value: pct(rentalChance),
              detail: `할인율 ${RENTAL_DISCOUNTS.join("% / ")}% 중 랜덤 · 시즌 한도 ${YANMAR_REWARD_CONFIG.rentalCouponSeasonLimit}장`,
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
            {
              label: "시즌 쿠폰 한도",
              value: "종류별 고정",
              detail:
                "시즌이 바뀌면 한도가 다시 채워집니다. 한도 소진 시 쿠폰 대신 스타가 지급됩니다.",
            },
          ],
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
              label: "필터세트 교환쿠폰",
              value: pct(filterChance, 4),
              detail: "하역과 동일 확률",
            },
            {
              label: "YK건기 부품 할인 쿠폰",
              value: pct(partsChance),
              detail: "하역과 동일 확률",
            },
            {
              label: "중장비 대여 할인 쿠폰",
              value: pct(rentalChance),
              detail: "하역과 동일 확률",
            },
            {
              label: "스타 보상",
              value: pct(starChance),
              detail: `${YANMAR_CRASH_REWARD_CONFIG.minStarReward}~${YANMAR_CRASH_REWARD_CONFIG.maxStarReward} 스타 랜덤`,
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
              value: pct(starChance),
              detail: `${YANMAR_HILL_REWARD_CONFIG.minStarReward}~${YANMAR_HILL_REWARD_CONFIG.maxStarReward} 스타 랜덤 · 쿠폰 확률은 하역과 동일`,
            },
            {
              label: "구역 규칙",
              value: "돌 5개(기본) · 트럭 적재 5개 · 리젠 300초",
              detail: "돌 고르기 강화로 돌 개수 증가 · 돌트럭속도 강화로 복귀 단축",
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
              detail: `강화 최대 +${capacityConfig.capacityPerLevel * capacityConfig.maxLevel} → ${maxTruckCapacity.toLocaleString()}`,
            },
            {
              label: "기본 재도착 대기",
              value: `${YANMAR_REWARD_CONFIG.baseTruckCooldownSec}초`,
              detail: `속도 강화 최소 ${minTruckCooldown.toFixed(0)}초 (레벨당 5% 단축)`,
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
                  ? `+${YANMAR_EQUIPMENT_CONFIG.TRUCK_CAPACITY.capacityPerLevel * config.maxLevel}`
                  : part === "TRUCK_SPEED"
                    ? `${getYanmarTruckCooldownSec(0).toFixed(0)}초 → ${getYanmarTruckCooldownSec(config.maxLevel).toFixed(0)}초`
                    : part === "CRASH_RESPAWN"
                      ? `${getYanmarBreakerDamage(0)} → ${getYanmarBreakerDamage(config.maxLevel)}`
                      : part === "GRAPPLE_ADHESION"
                        ? `+${Math.round(getYanmarGripAdhesionBonus(config.maxLevel) * 100)}%`
                      : part === "HAUL_TRUCK_SPEED"
                        ? `${getYanmarHaulTruckCooldownSec(0)}초 → ${Math.round(getYanmarHaulTruckCooldownSec(config.maxLevel))}초`
                      : part === "HILL_ROCK_PICK"
                        ? `${getYanmarHillBoulderCount(0)} → ${getYanmarHillBoulderCount(config.maxLevel)}`
                    : part === "ARM"
                      ? pctPoint(YANMAR_EQUIPMENT_CONFIG.ARM.effectPerLevel * config.maxLevel)
                      : part === "BOOM"
                        ? `+${(YANMAR_EQUIPMENT_CONFIG.BOOM.effectPerLevel * config.maxLevel * 100).toFixed(0)}%`
                        : part === "BUCKET"
                          ? `+${YANMAR_EQUIPMENT_CONFIG.BUCKET.effectPerLevel * config.maxLevel}`
                          : `+${(YANMAR_EQUIPMENT_CONFIG.ENGINE.effectPerLevel * config.maxLevel * 100).toFixed(0)}%`;
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
              label: "덤프트럭",
              value: "고정 비용표",
              detail: YANMAR_TRUCK_UPGRADE_COSTS.join(" / "),
            },
            {
              label: "브레이커 / 집게 / 돌트럭",
              value: "고정 비용표",
              detail: YANMAR_SPECIAL_UPGRADE_COSTS.join(" / "),
            },
            {
              label: "돌 고르기",
              value: "고정 비용표",
              detail: formatYanmarUpgradeCostSequence(
                "HILL_ROCK_PICK",
                YANMAR_EQUIPMENT_CONFIG.HILL_ROCK_PICK.maxLevel,
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
