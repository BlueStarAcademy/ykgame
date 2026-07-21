import type {
  DailyQuestDef,
  DailyQuestTargetSpec,
  MissionTaskDef,
  MissionTaskKind,
  QuestMetric,
  QuestReward,
  RepeatQuestDef,
} from "./types";

export const QUEST_MISSIONS_PER_DAY = 3;

export const DAILY_ALL_COMPLETE_QUEST_ID = "daily-all-complete";
export const DAILY_MISSION_CLEAR_QUEST_ID = "daily-mission-clear-3";

/** 클리어·수령 후 진행도가 초기화되어 다시 반복 가능한 퀘스트 */
export const REPEAT_QUEST_DEFS: readonly RepeatQuestDef[] = [
  {
    id: "repeat-soil-dump-10000",
    title: "흙 하역하기 10000",
    metric: "soilDump",
    target: 10000,
    minLevel: 1,
    reward: { stars: 5, xp: 0, enhanceCores: 1 },
  },
  {
    id: "repeat-asphalt-10",
    title: "파쇄하기 10개",
    metric: "asphaltBreak",
    target: 10,
    minLevel: 10,
    reward: { stars: 5, xp: 0, enhanceCores: 1 },
  },
  {
    id: "repeat-rock-dump-10",
    title: "돌 하역하기 10개",
    metric: "rockDump",
    target: 10,
    minLevel: 15,
    reward: { stars: 5, xp: 0, enhanceCores: 1 },
  },
  {
    id: "repeat-travel-10000",
    title: "주행거리 10000m",
    metric: "travel",
    target: 10000,
    minLevel: 1,
    reward: { stars: 5, xp: 0, enhanceCores: 1 },
  },
];

export const DAILY_QUEST_DEFS: readonly DailyQuestDef[] = [
  {
    id: "daily-login",
    title: () => "로그인 하기",
    metric: "login",
    target: 1,
    minLevel: 1,
    reward: { stars: 10, xp: 0, enhanceCores: 1 },
  },
  {
    id: "daily-horn",
    title: (t) => `경적 울리기 ${t}회`,
    metric: "horn",
    target: { min: 1, max: 5 },
    minLevel: 1,
    reward: { stars: 10, xp: 0, enhanceCores: 1 },
  },
  {
    id: "daily-soil-load",
    title: (t) => `흙 ${t.toLocaleString()} 적재하기`,
    metric: "soilLoad",
    target: { min: 3000, max: 5000, step: 100 },
    minLevel: 1,
    reward: { stars: 10, xp: 1000, enhanceCores: 1 },
  },
  {
    id: "daily-truck-depart",
    title: (t) => `트럭 출발 ${t}회`,
    metric: "dumpTruckDepart",
    target: { min: 2, max: 5 },
    minLevel: 1,
    reward: { stars: 10, xp: 1000, enhanceCores: 2 },
  },
  {
    id: "daily-travel-3000",
    title: (t) => `주행거리 ${t}m`,
    metric: "travel",
    target: 3000,
    minLevel: 1,
    reward: { stars: 10, xp: 1000, enhanceCores: 1 },
  },
  {
    id: "daily-asphalt-9",
    title: (t) => `파쇄하기 ${t}회`,
    metric: "asphaltBreak",
    target: 9,
    minLevel: 10,
    reward: { stars: 10, xp: 1500, enhanceCores: 2 },
  },
  {
    id: "daily-rock-load-5",
    title: (t) => `돌 적재 성공하기 ${t}회`,
    metric: "rockLoad",
    target: 5,
    minLevel: 15,
    reward: { stars: 10, xp: 2000, enhanceCores: 2 },
  },
  {
    id: DAILY_ALL_COMPLETE_QUEST_ID,
    title: () => "일일 퀘스트 모두 완료하기",
    metric: "dailyAllComplete",
    /** 실제 목표는 노출 중인 비메타 일일 수로 동기화된다 */
    target: 1,
    minLevel: 1,
    reward: { stars: 50, xp: 0, gachaTicketsPremium: 2 },
    meta: true,
  },
  {
    id: DAILY_MISSION_CLEAR_QUEST_ID,
    title: () => "미션퀘스트 3회 완료하기",
    metric: "missionClear",
    target: QUEST_MISSIONS_PER_DAY,
    minLevel: 1,
    reward: { stars: 50, xp: 0, gachaTicketsPremium: 2 },
    meta: true,
  },
] as const;

/** 난이도 1~5 보상 (경험치·스타·점수·강화코어·뽑기권) */
export const MISSION_DIFFICULTY_REWARDS: Record<1 | 2 | 3 | 4 | 5, QuestReward> = {
  1: {
    xp: 2000,
    stars: 10,
    score: 2000,
    enhanceCores: 2,
    gachaTicketsStandard: 1,
  },
  2: {
    xp: 3000,
    stars: 15,
    score: 3000,
    enhanceCores: 3,
    gachaTicketsStandard: 1,
  },
  3: {
    xp: 4000,
    stars: 20,
    score: 5000,
    enhanceCores: 5,
    gachaTicketsStandard: 1,
  },
  4: {
    xp: 5000,
    stars: 25,
    score: 7500,
    enhanceCores: 6,
    gachaTicketsStandard: 1,
  },
  5: {
    xp: 6000,
    stars: 30,
    score: 10000,
    enhanceCores: 8,
    gachaTicketsPremium: 1,
  },
};

export type MissionLevelBand = "under10" | "lv10" | "lv15";

export function getMissionLevelBand(level: number): MissionLevelBand {
  if (level >= 15) return "lv15";
  if (level >= 10) return "lv10";
  return "under10";
}

export function getMissionMaxDifficulty(band: MissionLevelBand): 2 | 3 | 5 {
  if (band === "lv15") return 5;
  if (band === "lv10") return 3;
  return 2;
}

export function getMissionOptionalCount(_band: MissionLevelBand): 1 {
  return 1;
}

type MissionPoolEntry = {
  kind: MissionTaskKind;
  metric: QuestMetric;
  label: (target: number) => string;
  min: number;
  max: number;
  required: boolean;
};

/** 관리자 문서·미션 생성 공용 풀. */
export const MISSION_POOL: Record<MissionLevelBand, MissionPoolEntry[]> = {
  under10: [
    {
      kind: "soilDump",
      metric: "soilDump",
      label: (t) => `흙 하역 ${t.toLocaleString()}`,
      min: 300,
      max: 800,
      required: true,
    },
    {
      kind: "horn",
      metric: "horn",
      label: (t) => `경적 ${t}회`,
      min: 1,
      max: 2,
      required: false,
    },
    {
      kind: "swing180",
      metric: "swing180",
      label: (t) => `상부 180° 회전 ${t}회`,
      min: 1,
      max: 2,
      required: false,
    },
    {
      kind: "travel",
      metric: "travel",
      label: (t) => `주행거리 ${t}m`,
      min: 50,
      max: 150,
      required: false,
    },
  ],
  lv10: [
    {
      kind: "soilDump",
      metric: "soilDump",
      label: (t) => `흙 하역 ${t.toLocaleString()}`,
      min: 800,
      max: 1500,
      required: true,
    },
    {
      kind: "asphaltBreak",
      metric: "asphaltBreak",
      label: (t) => `파쇄 ${t}개`,
      min: 3,
      max: 5,
      required: true,
    },
    {
      kind: "horn",
      metric: "horn",
      label: (t) => `경적 ${t}회`,
      min: 1,
      max: 2,
      required: false,
    },
    {
      kind: "swing180",
      metric: "swing180",
      label: (t) => `상부 180° 회전 ${t}회`,
      min: 1,
      max: 2,
      required: false,
    },
    {
      kind: "travel",
      metric: "travel",
      label: (t) => `주행거리 ${t}m`,
      min: 50,
      max: 150,
      required: false,
    },
  ],
  lv15: [
    {
      kind: "soilDump",
      metric: "soilDump",
      label: (t) => `흙 하역 ${t.toLocaleString()}`,
      min: 1500,
      max: 3000,
      required: true,
    },
    {
      kind: "asphaltBreak",
      metric: "asphaltBreak",
      label: (t) => `파쇄 ${t}개`,
      min: 3,
      max: 5,
      required: true,
    },
    {
      kind: "rockLoad",
      metric: "rockLoad",
      label: (t) => `돌 적재 성공 ${t}회`,
      min: 1,
      max: 2,
      required: true,
    },
    {
      kind: "dumpTruckDepart",
      metric: "dumpTruckDepart",
      label: (t) => `덤프트럭 보내기 ${t}회`,
      min: 1,
      max: 1,
      required: false,
    },
    {
      kind: "travel",
      metric: "travel",
      label: (t) => `주행거리 ${t}m`,
      min: 200,
      max: 500,
      required: false,
    },
    {
      kind: "haulTruckDepart",
      metric: "haulTruckDepart",
      label: (t) => `돌트럭 보내기 ${t}회`,
      min: 1,
      max: 1,
      required: false,
    },
  ],
};

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/** 난이도에 맞춰 목표치를 범위 안에서 뽑는다. */
function rollTarget(min: number, max: number, difficulty: number, maxDiff: number) {
  if (max <= min) return min;
  const t = (difficulty - 1) / Math.max(1, maxDiff - 1);
  const center = min + (max - min) * t;
  const spread = (max - min) * 0.12;
  const low = Math.max(min, Math.floor(center - spread));
  const high = Math.min(max, Math.ceil(center + spread));
  return randomInt(low, high);
}

export function rollDailyQuestTarget(spec: DailyQuestTargetSpec): number {
  if (typeof spec === "number") return spec;
  const step = spec.step ?? 1;
  if (step <= 1) return randomInt(spec.min, spec.max);
  const steps = Math.floor((spec.max - spec.min) / step);
  return spec.min + randomInt(0, Math.max(0, steps)) * step;
}

export function describeDailyQuestTarget(spec: DailyQuestTargetSpec): string {
  if (typeof spec === "number") return spec.toLocaleString();
  const step = spec.step ?? 1;
  const range = `${spec.min.toLocaleString()} ~ ${spec.max.toLocaleString()}`;
  return step > 1 ? `${range} (${step}단위)` : range;
}

export function buildMissionTasks(
  band: MissionLevelBand,
  difficulty: 1 | 2 | 3 | 4 | 5,
  roundIndex: number,
): MissionTaskDef[] {
  const pool = MISSION_POOL[band];
  const maxDiff = getMissionMaxDifficulty(band);
  const required = pool.filter((entry) => entry.required);
  const optional = shuffle(pool.filter((entry) => !entry.required)).slice(
    0,
    getMissionOptionalCount(band),
  );
  const selected = [...required, ...optional];

  return selected.map((entry, i) => {
    const target = rollTarget(entry.min, entry.max, difficulty, maxDiff);
    return {
      id: `m${roundIndex}-${entry.kind}-${i}`,
      kind: entry.kind,
      metric: entry.metric,
      label: entry.label(target),
      target,
      required: entry.required,
    };
  });
}

export function rollMissionDifficulty(band: MissionLevelBand): 1 | 2 | 3 | 4 | 5 {
  const max = getMissionMaxDifficulty(band);
  return randomInt(1, max) as 1 | 2 | 3 | 4 | 5;
}

export function formatQuestReward(reward: QuestReward) {
  const parts: string[] = [];
  if (reward.xp > 0) parts.push(`${reward.xp.toLocaleString()} EXP`);
  if (reward.stars > 0) parts.push(`${reward.stars} 스타`);
  if ((reward.score ?? 0) > 0) parts.push(`${reward.score!.toLocaleString()}점`);
  if ((reward.enhanceCores ?? 0) > 0) {
    parts.push(`강화코어 ${reward.enhanceCores}`);
  }
  if ((reward.gachaTicketsStandard ?? 0) > 0) {
    parts.push(`일반 뽑기권 ${reward.gachaTicketsStandard}`);
  }
  if ((reward.gachaTicketsPremium ?? 0) > 0) {
    parts.push(`고급 뽑기권 ${reward.gachaTicketsPremium}`);
  }
  return parts.join(" + ") || "보상 없음";
}

export function metricUnitLabel(metric: QuestMetric) {
  switch (metric) {
    case "travel":
      return "m";
    case "soilLoad":
    case "soilDump":
      return "";
    case "dailyAllComplete":
      return "개";
    default:
      return "회";
  }
}

export function isMetaDailyQuest(def: Pick<DailyQuestDef, "meta" | "id">) {
  if (def.meta) return true;
  return (
    def.id === DAILY_ALL_COMPLETE_QUEST_ID ||
    def.id === DAILY_MISSION_CLEAR_QUEST_ID
  );
}
