import {
  GACHA_CONFIG,
  WORK_GEAR_DROP_BASE_CHANCE,
  WORK_GEAR_DROP_GRADES,
  WORK_CORE_DROP,
  GEAR_INVENTORY_BASE,
  GEAR_INVENTORY_MAX,
  GEAR_INVENTORY_EXPAND_STEP,
  GRADE_COST_MULT,
  DISMANTLE_CORE_GRADE_BASE,
  DISMANTLE_CORE_ENHANCE_BONUS,
} from "@/games/yanmar/gearCatalog";
import {
  YANMAR_REWARD_CONFIG,
  YANMAR_CRASH_REWARD_CONFIG,
  YANMAR_HILL_REWARD_CONFIG,
} from "@/games/yanmar/equipment";
import {
  DUMP_TRUCK_ARRIVE_DURATION_SEC,
  DUMP_TRUCK_DEPART_DURATION_SEC,
  DUMP_TRUCK_ENGINE_START_DURATION_SEC,
} from "@/games/yanmar/dumpTruckState";
import {
  getEnhanceCost,
  getEnhanceCoreCost,
  getEnhanceSuccessRate,
  getDismantleEnhanceCores,
} from "@/games/yanmar/gearGenerate";

const PARTS_DISCOUNTS = [10, 15, 20] as const;
const RENTAL_DISCOUNTS = [10, 20, 30] as const;

function pct(value: number, digits = 2) {
  return `${(value * 100).toFixed(digits)}%`;
}

function pctFromFraction(value: number, digits = 5) {
  return `${(value * 100).toFixed(digits)}%`;
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

  const enhanceRateRows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => {
    const cost = getEnhanceCost(level, "NORMAL");
    const cores = getEnhanceCoreCost(level, "NORMAL");
    const rate = getEnhanceSuccessRate(level, 0, "NORMAL");
    return [
      `+${level - 1} → +${level}`,
      cost == null
        ? "MAX"
        : `${cost}★${cores > 0 ? ` · 코어 ${cores}` : ""} · ${pct(rate, 0)}`,
    ];
  });

  const gradeCostRows = (
    ["NORMAL", "ENHANCED", "PRECISION", "MASTER"] as const
  ).map((grade) => [grade, `×${GRADE_COST_MULT[grade]}`]);

  const dismantleRows = (
    ["NORMAL", "ENHANCED", "PRECISION", "MASTER"] as const
  ).map((grade) => [
    grade,
    `${getDismantleEnhanceCores(grade, 0)} ~ ${getDismantleEnhanceCores(grade, 10)}`,
  ]);

  const coreDropRows = (
    Object.entries(WORK_CORE_DROP) as [
      keyof typeof WORK_CORE_DROP,
      (typeof WORK_CORE_DROP)[keyof typeof WORK_CORE_DROP],
    ][]
  ).map(([key, cfg]) => [
    key,
    `${pct(cfg.chance, 0)} · ${
      cfg.min === cfg.max ? cfg.min : `${cfg.min}~${cfg.max}`
    }개`,
  ]);

  const gearSections = [
    {
      title: "작업 중 장비 드롭",
      items: [
        {
          label: "기본 획득 판정",
          value: pct(WORK_GEAR_DROP_BASE_CHANCE),
          detail:
            "흙 하역 / 파쇄 / 돌 하역 / 트럭 만재 시 독립 판정 · 마스터 옵션 보유 시 상대 +10%",
        },
        {
          label: "등급 확률 (성공 시)",
          value: "조건부",
          table: {
            columns: ["등급", "확률"],
            rows: WORK_GEAR_DROP_GRADES.map((g) => [
              g.grade,
              pct(g.weight / 100, 2),
            ]),
          },
        },
        {
          label: "인벤토리 가득",
          value: "우편 스타 전환",
          detail: `플레이어 장비 칸(기본 ${GEAR_INVENTORY_BASE}·최대 ${GEAR_INVENTORY_MAX}·${GEAR_INVENTORY_EXPAND_STEP}칸 단위 확장) 초과 시 드롭 성공분만 등급별 스타로 우편 지급 (실패 판정은 메일 없음)`,
        },
      ],
    },
    {
      title: "작업 중 강화코어 드롭",
      items: [
        {
          label: "독립 판정",
          value: "장비 드롭과 별도",
          detail: "작업 완료 시 확률로 강화코어 지급",
          table: {
            columns: ["트리거", "확률·개수"],
            rows: coreDropRows,
          },
        },
      ],
    },
    {
      title: "장비 가챠 — 일반뽑기",
      items: [
        {
          label: "비용",
          value: `1회 ${GACHA_CONFIG.STANDARD.cost1}★ · 10연 ${GACHA_CONFIG.STANDARD.cost10}★`,
          detail: "일반~정밀 (마스터 미포함)",
        },
        {
          label: "등급 가중치",
          value: "상대",
          table: {
            columns: ["등급", "가중치"],
            rows: GACHA_CONFIG.STANDARD.grades.map((g) => [
              g.grade,
              String(g.weight),
            ]),
          },
        },
      ],
    },
    {
      title: "장비 가챠 — 고급뽑기",
      items: [
        {
          label: "비용",
          value: `1회 ${GACHA_CONFIG.PREMIUM.cost1}★ · 10연 ${GACHA_CONFIG.PREMIUM.cost10}★`,
          detail: "강화~마스터 (일반 미포함)",
        },
        {
          label: "등급 가중치",
          value: "상대",
          table: {
            columns: ["등급", "가중치"],
            rows: GACHA_CONFIG.PREMIUM.grades.map((g) => [
              g.grade,
              String(g.weight),
            ]),
          },
        },
      ],
    },
    {
      title: "장비 강화",
      items: [
        {
          label: "일반 기준 비용·성공률",
          value: "단계별",
          detail:
            "스타 + 강화코어(+3부터) · 비용 등급배율 ×1/1.5/2.25/3.375 · 고등급일수록 성공률·실패가산 하향",
          table: {
            columns: ["단계", "일반 비용·성공률(보너스 0)"],
            rows: enhanceRateRows,
          },
        },
        {
          label: "등급 비용 배율",
          value: "⌈일반×배율⌉",
          table: {
            columns: ["등급", "배율"],
            rows: gradeCostRows,
          },
        },
        {
          label: "분해 보상",
          value: "강화코어만",
          detail: `스타 환불 없음 · base(${Object.values(DISMANTLE_CORE_GRADE_BASE).join("/")}) + 강화보너스(0~${DISMANTLE_CORE_ENHANCE_BONUS[10]})`,
          table: {
            columns: ["등급", "코어(+0~+10)"],
            rows: dismantleRows,
          },
        },
        {
          label: "마일스톤",
          value: "+3 / +6 / +9 / +10",
          detail:
            "도달 시 부옵션 티어업 또는 신규 T1 추가(첫 옵션=+N%·이름접두어, 이후=+N, 능력치 종류 중복 없음)",
        },
      ],
    },
  ];

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
      value: "흙 하역 · 파쇄 · 돌 트럭 적재/하역",
      detail: "dump / crash / hill 보상 API 공통 드롭 모델",
    },
  ];

  return {
    yanmar: {
      title: "얀마 굴착기 — 하역·장비·가챠",
      sections: [
        ...gearSections,
        {
          title: "기본 점수",
          items: [
            {
              label: "점수 청크 단위",
              value: `${YANMAR_REWARD_CONFIG.scoreChunkUnits} 적재량`,
            },
            {
              label: "청크당 기본 점수",
              value: `${YANMAR_REWARD_CONFIG.baseScorePerChunkMin}~${YANMAR_REWARD_CONFIG.baseScorePerChunkMax}점 (랜덤)`,
            },
            {
              label: "기본 크리티컬 확률",
              value: pct(YANMAR_REWARD_CONFIG.baseCriticalChance),
              detail: "차체 기술·장비(암) 주옵션으로 증가",
            },
            {
              label: "기본 크리티컬 배율",
              value: `×${YANMAR_REWARD_CONFIG.baseCriticalMultiplier}`,
              detail: "붐 주옵션·부옵션으로 증가",
            },
          ],
        },
        {
          title: "하역·파괴·돌 하역 보상 확률 (1회 롤)",
          items: sharedDropRewardItems,
        },
        {
          title: "파쇄 보상 (타일 1개)",
          items: [
            {
              label: "기본 점수",
              value: `${YANMAR_CRASH_REWARD_CONFIG.baseScoreMin}~${YANMAR_CRASH_REWARD_CONFIG.baseScoreMax}점 (랜덤)`,
              detail: "장착 장비 크리티컬 확률·배율 적용",
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
              detail: "같은 자리에 파쇄 타일 9칸 일괄 리젠",
            },
          ],
        },
        {
          title: "Hill 돌 운반 보상 (돌 1개 트럭 적재)",
          items: [
            {
              label: "기본 점수",
              value: `${YANMAR_HILL_REWARD_CONFIG.baseScoreMin}~${YANMAR_HILL_REWARD_CONFIG.baseScoreMax}점 (랜덤)`,
              detail: "장착 장비 크리티컬 확률·배율 적용",
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
              value: "돌 5개 · 트럭 적재 고정 용량 · 리젠 300초",
              detail: "트럭/하역 강화는 제거됨 · 차체·장비 스탯으로만 성장",
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
              label: "트럭 용량·쿨다운",
              value: "고정 베이스",
              detail: `용량 ${YANMAR_REWARD_CONFIG.baseTruckCapacityUnits.toLocaleString()} · 재도착 ${YANMAR_REWARD_CONFIG.baseTruckCooldownSec}초 (구 트럭 강화 제거)`,
            },
            {
              label: "기본 최대 적재량(버켓)",
              value: `${YANMAR_REWARD_CONFIG.baseMaxLoadUnits}`,
              detail: "차체 힘 + 버켓 장비로 증가",
            },
          ],
        },
      ],
    },
  };
}
