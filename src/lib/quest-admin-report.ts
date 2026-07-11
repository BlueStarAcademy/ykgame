import {
  DAILY_QUEST_DEFS,
  MISSION_DIFFICULTY_REWARDS,
  MISSION_POOL,
  QUEST_MISSIONS_PER_DAY,
  REPEAT_QUEST_DEFS,
  describeDailyQuestTarget,
  formatQuestReward,
  getMissionMaxDifficulty,
  getMissionOptionalCount,
  type MissionLevelBand,
} from "@/games/yanmar/quests/config";

const BAND_LABELS: Record<MissionLevelBand, string> = {
  under10: "레벨 1~9",
  lv10: "레벨 10~14",
  lv15: "레벨 15+",
};

function taskKindLabel(kind: string) {
  switch (kind) {
    case "soilDump":
      return "흙 하역";
    case "asphaltBreak":
      return "아스팔트 크래쉬";
    case "rockLoad":
      return "돌 적재 성공";
    case "horn":
      return "경적";
    case "swing180":
      return "상부 180° 회전";
    case "travel":
      return "주행거리";
    case "dumpTruckDepart":
      return "덤프트럭 보내기";
    case "haulTruckDepart":
      return "돌트럭 보내기";
    default:
      return kind;
  }
}

function formatReward(stars: number, xp: number) {
  return formatQuestReward({ stars, xp });
}

function dailyQuestLabel(def: (typeof DAILY_QUEST_DEFS)[number]) {
  const sample =
    typeof def.target === "number"
      ? def.target
      : def.target.min;
  return def.title(sample);
}

export function getQuestAdminReport() {
  const dailyRows = DAILY_QUEST_DEFS.map((def) => ({
    level: dailyQuestLabel(def),
    value: `Lv${def.minLevel}+ · 목표 ${describeDailyQuestTarget(def.target)} · ${formatReward(def.reward.stars, def.reward.xp)}`,
  }));

  const repeatRows = REPEAT_QUEST_DEFS.map((def) => ({
    level: def.title,
    value: `Lv${def.minLevel}+ · 목표 ${def.target.toLocaleString()} · ${formatReward(def.reward.stars, def.reward.xp)}`,
  }));

  const difficultyRows = (
    Object.entries(MISSION_DIFFICULTY_REWARDS) as Array<
      [string, { xp: number; stars: number }]
    >
  ).map(([diff, reward]) => ({
    level: `난이도 ${diff}`,
    value: formatReward(reward.stars, reward.xp),
  }));

  const bandSections = (["under10", "lv10", "lv15"] as MissionLevelBand[]).map(
    (band) => {
      const pool = MISSION_POOL[band];
      const required = pool.filter((entry) => entry.required);
      const optional = pool.filter((entry) => !entry.required);
      return {
        title: `미션 과제 풀 — ${BAND_LABELS[band]}`,
        items: [
          {
            label: "최대 난이도",
            value: `D${getMissionMaxDifficulty(band)}`,
          },
          {
            label: "선택 과제 수",
            value: `${getMissionOptionalCount(band)}개`,
            detail: "필수 과제는 전부 포함되고, 선택 과제는 풀에서 무작위로 뽑습니다.",
          },
          {
            label: "필수 과제",
            value: `${required.length}종`,
            table: {
              columns: ["과제", "목표 범위"] as [string, string],
              rows: required.map((entry) => ({
                level: taskKindLabel(entry.kind),
                value: `${entry.min.toLocaleString()} ~ ${entry.max.toLocaleString()}`,
              })),
            },
          },
          {
            label: "선택 과제",
            value: `${optional.length}종`,
            table: {
              columns: ["과제", "목표 범위"] as [string, string],
              rows: optional.map((entry) => ({
                level: taskKindLabel(entry.kind),
                value: `${entry.min.toLocaleString()} ~ ${entry.max.toLocaleString()}`,
              })),
            },
          },
        ],
      };
    },
  );

  return {
    title: "얀마 굴착기 — 퀘스트",
    sections: [
      {
        title: "공통 규칙",
        items: [
          {
            label: "갱신 주기",
            value: "매일 자정(KST)",
            detail: "일일·미션 진행도가 날짜 키 기준으로 초기화됩니다.",
          },
          {
            label: "진행 저장",
            value: "클라이언트 localStorage",
            detail: "수령(claim)만 서버 API로 스타·경험치를 지급합니다.",
          },
          {
            label: "일일 미션 개수",
            value: `${QUEST_MISSIONS_PER_DAY}개`,
            detail: "순서대로 1개씩 진행·클리어합니다.",
          },
          {
            label: "수령 API 상한",
            value: "스타 30 / EXP 3,000 (1회)",
            detail: "POST /api/rewards/yanmar-quest · eventId는 quest: 접두사 필수",
          },
          {
            label: "반복 퀘스트",
            value: `${REPEAT_QUEST_DEFS.length}종 · 수령 후 재진행`,
            detail: "목표 달성·수령 시 진행도가 초기화되어 같은 날에도 반복 수령할 수 있습니다.",
          },
        ],
      },
      {
        title: "일일 퀘스트",
        items: [
          {
            label: "목록",
            value: `${DAILY_QUEST_DEFS.length}종 · 레벨별 노출`,
            detail: "플레이어 레벨이 minLevel 이상일 때만 표시·진행됩니다.",
            table: {
              columns: ["퀘스트", "개방 · 보상"] as [string, string],
              rows: dailyRows,
            },
          },
        ],
      },
      {
        title: "반복 퀘스트",
        items: [
          {
            label: "목록",
            value: `${REPEAT_QUEST_DEFS.length}종 · 레벨별 노출`,
            detail: "클리어 보상 수령 후 목표가 다시 활성화됩니다.",
            table: {
              columns: ["퀘스트", "개방 · 보상"] as [string, string],
              rows: repeatRows,
            },
          },
        ],
      },
      {
        title: "미션 난이도 보상",
        items: [
          {
            label: "난이도 1~5",
            value: "클리어 1회당 지급",
            detail: "난이도는 레벨 밴드 상한 안에서 매일 미션마다 랜덤으로 정해집니다.",
            table: {
              columns: ["난이도", "보상"] as [string, string],
              rows: difficultyRows,
            },
          },
        ],
      },
      {
        title: "미션 레벨 밴드",
        items: [
          {
            label: "레벨 1~9",
            value: `최대 D${getMissionMaxDifficulty("under10")} · 선택 ${getMissionOptionalCount("under10")}개`,
            detail: "흙 하역 필수 + 경적/스윙/주행 중 선택",
          },
          {
            label: "레벨 10~14",
            value: `최대 D${getMissionMaxDifficulty("lv10")} · 선택 ${getMissionOptionalCount("lv10")}개`,
            detail: "흙 하역·아스팔트 필수 + 선택 2개",
          },
          {
            label: "레벨 15+",
            value: `최대 D${getMissionMaxDifficulty("lv15")} · 선택 ${getMissionOptionalCount("lv15")}개`,
            detail: "흙 하역·아스팔트·돌 적재 필수 + 선택 2개",
          },
        ],
      },
      ...bandSections,
    ],
  };
}
