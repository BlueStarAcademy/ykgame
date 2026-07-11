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
  | "swing180"
  | "haulTruckDepart";

export type QuestReward = {
  stars: number;
  xp: number;
};

export type DailyQuestDef = {
  id: string;
  title: string;
  metric: QuestMetric;
  target: number;
  /** 이 레벨 이상일 때 목록에 표시 */
  minLevel: number;
  reward: QuestReward;
};

export type DailyQuestProgress = {
  id: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
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
  version: 1;
  dayKey: string;
  ownerId: string;
  levelBand: "under10" | "lv10" | "lv15";
  daily: DailyQuestProgress[];
  missions: MissionRound[];
  /** 오늘 클리어(클레임)한 미션 수 0~10 */
  missionsCleared: number;
};

export type QuestProgressEvent = {
  metric: QuestMetric;
  amount: number;
};
