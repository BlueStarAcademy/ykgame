export type QuestTab = "daily" | "mission" | "repeat";

export type QuestMetric =
  | "login"
  | "horn"
  | "soilLoad"
  | "soilDump"
  | "dumpTruckDepart"
  | "travel"
  | "asphaltBreak"
  | "rockLoad"
  | "rockDump"
  | "swing180"
  | "haulTruckDepart"
  /** 다른 일일 퀘스트 완료 수 (메타) */
  | "dailyAllComplete"
  /** 미션 퀘스트 클리어 수 (메타) */
  | "missionClear";

export type QuestReward = {
  stars: number;
  xp: number;
  /** 미션 등 아케이드 점수 보상 (선택) */
  score?: number;
  /** 강화코어 */
  enhanceCores?: number;
  /** 일반 뽑기권 */
  gachaTicketsStandard?: number;
  /** 고급 뽑기권 */
  gachaTicketsPremium?: number;
};

/** 고정 목표, 또는 min~max(step 단위) 랜덤 목표 */
export type DailyQuestTargetSpec =
  | number
  | { min: number; max: number; step?: number };

export type DailyQuestDef = {
  id: string;
  title: (target: number) => string;
  metric: QuestMetric;
  target: DailyQuestTargetSpec;
  /** 이 레벨 이상일 때 목록에 표시 */
  minLevel: number;
  reward: QuestReward;
  /**
   * 메타 일일(모두 완료·미션 N회 등).
   * 「일일 퀘스트 모두 완료」집계에서 제외된다.
   */
  meta?: boolean;
};

export type DailyQuestProgress = {
  id: string;
  /** 오늘 배정된 목표치 (랜덤 퀘스트는 생성 시 고정) */
  target: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
};

export type RepeatQuestDef = {
  id: string;
  title: string;
  metric: QuestMetric;
  target: number;
  minLevel: number;
  reward: QuestReward;
};

export type RepeatQuestProgress = {
  id: string;
  progress: number;
  completed: boolean;
  /** 오늘 수령 횟수 (eventId 고유성) */
  claimCount: number;
};

export type MissionTaskKind =
  | "soilDump"
  | "asphaltBreak"
  | "rockLoad"
  | "horn"
  | "swing180"
  | "travel"
  | "dumpTruckDepart"
  | "haulTruckDepart";

export type MissionTaskDef = {
  id: string;
  kind: MissionTaskKind;
  metric: QuestMetric;
  label: string;
  target: number;
  required: boolean;
};

export type MissionRound = {
  index: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  tasks: MissionTaskDef[];
  progress: Record<string, number>;
  completed: boolean;
  claimed: boolean;
};

export type YanmarQuestState = {
  version: 2;
  dayKey: string;
  ownerId: string;
  levelBand: "under10" | "lv10" | "lv15";
  daily: DailyQuestProgress[];
  missions: MissionRound[];
  /** 오늘 클리어(클레임)한 미션 수 0~QUEST_MISSIONS_PER_DAY */
  missionsCleared: number;
  repeat: RepeatQuestProgress[];
};

export type QuestProgressEvent = {
  metric: QuestMetric;
  amount: number;
};
