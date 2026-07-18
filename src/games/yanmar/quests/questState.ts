import {
  DAILY_ALL_COMPLETE_QUEST_ID,
  DAILY_MISSION_CLEAR_QUEST_ID,
  DAILY_QUEST_DEFS,
  MISSION_DIFFICULTY_REWARDS,
  QUEST_MISSIONS_PER_DAY,
  REPEAT_QUEST_DEFS,
  buildMissionTasks,
  getMissionLevelBand,
  isMetaDailyQuest,
  rollDailyQuestTarget,
  rollMissionDifficulty,
  type MissionLevelBand,
} from "./config";
import type {
  DailyQuestDef,
  DailyQuestProgress,
  MissionRound,
  QuestMetric,
  QuestProgressEvent,
  QuestReward,
  RepeatQuestDef,
  RepeatQuestProgress,
  YanmarQuestState,
} from "./types";

export type { YanmarQuestState, QuestMetric };

const STORAGE_PREFIX = "ykgame:yanmar:quests:v2";
const QUEST_STATE_VERSION = 2 as const;

function storageKey(ownerId: string) {
  return `${STORAGE_PREFIX}:${ownerId}`;
}

/** Asia/Seoul 기준 날짜 키 */
export function getQuestDayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** 다음 일일 퀘스트 초기화(KST 자정)까지 남은 ms */
export function getMsUntilNextQuestReset(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth();
  const day = kst.getUTCDate();
  const nextMidnightUtc = Date.UTC(year, month, day + 1, 0, 0, 0, 0) - 9 * 60 * 60 * 1000;
  return Math.max(0, nextMidnightUtc - now.getTime());
}

/** `H:MM:SS` — 초기화까지 남은 시간 */
export function formatQuestResetCountdown(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function createDailyItem(def: DailyQuestDef): DailyQuestProgress {
  return {
    id: def.id,
    target: rollDailyQuestTarget(def.target),
    progress: 0,
    completed: false,
    claimed: false,
  };
}

function ensureDailyTarget(
  item: DailyQuestProgress,
  def: DailyQuestDef,
): DailyQuestProgress {
  if (typeof item.target === "number" && item.target > 0) return item;
  if (item.completed || item.claimed) {
    return { ...item, target: Math.max(1, Math.floor(item.progress) || 1) };
  }
  return { ...item, target: rollDailyQuestTarget(def.target) };
}

function createDailyProgress(level: number): DailyQuestProgress[] {
  return DAILY_QUEST_DEFS.filter((def) => level >= def.minLevel).map(createDailyItem);
}

function createRepeatItem(def: RepeatQuestDef): RepeatQuestProgress {
  return {
    id: def.id,
    progress: 0,
    completed: false,
    claimCount: 0,
  };
}

function createRepeatProgress(level: number): RepeatQuestProgress[] {
  return REPEAT_QUEST_DEFS.filter((def) => level >= def.minLevel).map(createRepeatItem);
}

function createMissionRounds(band: MissionLevelBand): MissionRound[] {
  return Array.from({ length: QUEST_MISSIONS_PER_DAY }, (_, index) => {
    const difficulty = rollMissionDifficulty(band);
    const tasks = buildMissionTasks(band, difficulty, index);
    return {
      index,
      difficulty,
      tasks,
      progress: Object.fromEntries(tasks.map((task) => [task.id, 0])),
      completed: false,
      claimed: false,
    };
  });
}

/** 메타 일일(모두 완료·미션 N회) 진행도를 현재 상태에서 다시 맞춘다 */
function syncMetaDailyQuests(state: YanmarQuestState): YanmarQuestState {
  const nonMeta = state.daily.filter((item) => {
    const def = DAILY_QUEST_DEFS.find((entry) => entry.id === item.id);
    return def ? !isMetaDailyQuest(def) : !isMetaDailyQuest({ id: item.id });
  });
  const allTarget = Math.max(1, nonMeta.length);
  const allProgress = nonMeta.filter((item) => item.completed).length;
  const missionProgress = Math.max(
    0,
    Math.min(QUEST_MISSIONS_PER_DAY, state.missionsCleared),
  );

  let changed = false;
  const daily = state.daily.map((item) => {
    if (item.claimed) return item;

    if (item.id === DAILY_ALL_COMPLETE_QUEST_ID) {
      const progress = Math.min(allTarget, allProgress);
      const completed = nonMeta.length > 0 && allProgress >= nonMeta.length;
      if (
        item.target === allTarget &&
        item.progress === progress &&
        item.completed === completed
      ) {
        return item;
      }
      changed = true;
      return { ...item, target: allTarget, progress, completed };
    }

    if (item.id === DAILY_MISSION_CLEAR_QUEST_ID) {
      const target = QUEST_MISSIONS_PER_DAY;
      const progress = missionProgress;
      const completed = progress >= target;
      if (
        item.target === target &&
        item.progress === progress &&
        item.completed === completed
      ) {
        return item;
      }
      changed = true;
      return { ...item, target, progress, completed };
    }

    return item;
  });

  if (!changed) return state;
  return { ...state, daily };
}

export function createQuestState(ownerId: string, level: number): YanmarQuestState {
  const band = getMissionLevelBand(level);
  return syncMetaDailyQuests({
    version: QUEST_STATE_VERSION,
    dayKey: getQuestDayKey(),
    ownerId,
    levelBand: band,
    daily: createDailyProgress(level),
    repeat: createRepeatProgress(level),
    missions: createMissionRounds(band),
    missionsCleared: 0,
  });
}

function isValidState(value: unknown): value is YanmarQuestState {
  if (!value || typeof value !== "object") return false;
  const state = value as YanmarQuestState;
  return (
    state.version === QUEST_STATE_VERSION &&
    typeof state.dayKey === "string" &&
    typeof state.ownerId === "string" &&
    Array.isArray(state.daily) &&
    Array.isArray(state.missions)
  );
}

export function loadQuestState(ownerId: string, level: number): YanmarQuestState {
  if (typeof window === "undefined") {
    return createQuestState(ownerId, level);
  }
  try {
    const raw = window.localStorage.getItem(storageKey(ownerId));
    if (!raw) return createQuestState(ownerId, level);
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidState(parsed) || parsed.ownerId !== ownerId) {
      return createQuestState(ownerId, level);
    }
    const today = getQuestDayKey();
    if (parsed.dayKey !== today) {
      return createQuestState(ownerId, level);
    }

    const band = getMissionLevelBand(level);
    // 레벨이 올라 새 일일 퀘스트가 열리면 목록에 합류시킨다.
    const known = new Set(parsed.daily.map((item) => item.id));
    const mergedDaily: DailyQuestProgress[] = [];
    for (const item of parsed.daily) {
      const def = DAILY_QUEST_DEFS.find((entry) => entry.id === item.id);
      if (!def) continue;
      mergedDaily.push(ensureDailyTarget(item, def));
    }
    for (const def of DAILY_QUEST_DEFS) {
      if (level >= def.minLevel && !known.has(def.id)) {
        mergedDaily.push(createDailyItem(def));
      }
    }

    const knownRepeat = new Set((parsed.repeat ?? []).map((item) => item.id));
    const mergedRepeat: RepeatQuestProgress[] = [];
    for (const item of parsed.repeat ?? []) {
      const def = REPEAT_QUEST_DEFS.find((entry) => entry.id === item.id);
      if (!def) continue;
      mergedRepeat.push({
        id: item.id,
        progress: typeof item.progress === "number" ? item.progress : 0,
        completed: Boolean(item.completed),
        claimCount:
          typeof item.claimCount === "number" && item.claimCount >= 0
            ? Math.floor(item.claimCount)
            : 0,
      });
    }
    for (const def of REPEAT_QUEST_DEFS) {
      if (level >= def.minLevel && !knownRepeat.has(def.id)) {
        mergedRepeat.push(createRepeatItem(def));
      }
    }

    const needsMissionReset =
      !Array.isArray(parsed.missions) ||
      parsed.missions.length !== QUEST_MISSIONS_PER_DAY;

    return syncMetaDailyQuests({
      ...parsed,
      version: QUEST_STATE_VERSION,
      levelBand: parsed.levelBand ?? band,
      daily: mergedDaily,
      repeat: mergedRepeat,
      missions: needsMissionReset
        ? createMissionRounds(band)
        : parsed.missions,
      missionsCleared: needsMissionReset
        ? 0
        : Math.max(
            0,
            Math.min(
              QUEST_MISSIONS_PER_DAY,
              parsed.missionsCleared ??
                parsed.missions.filter((m) => m.claimed).length,
            ),
          ),
    });
  } catch {
    return createQuestState(ownerId, level);
  }
}

export function saveQuestState(state: YanmarQuestState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(state.ownerId), JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

function applyMetric(
  progress: number,
  target: number,
  amount: number,
): { progress: number; completed: boolean } {
  const next = Math.min(target, progress + Math.max(0, amount));
  return { progress: next, completed: next >= target };
}

export function applyQuestProgress(
  state: YanmarQuestState,
  event: QuestProgressEvent,
): YanmarQuestState {
  if (event.amount <= 0) return state;

  let changed = false;
  const daily = state.daily.map((item) => {
    if (item.claimed || item.completed) return item;
    const def = DAILY_QUEST_DEFS.find((entry) => entry.id === item.id);
    if (!def || def.metric !== event.metric) return item;
    const target = item.target > 0 ? item.target : rollDailyQuestTarget(def.target);
    const next = applyMetric(item.progress, target, event.amount);
    if (next.progress === item.progress && item.target === target) return item;
    changed = true;
    return {
      ...item,
      target,
      progress: next.progress,
      completed: next.completed,
    };
  });

  const repeatSource = state.repeat ?? [];
  const repeat = repeatSource.map((item) => {
    if (item.completed) return item;
    const def = REPEAT_QUEST_DEFS.find((entry) => entry.id === item.id);
    if (!def || def.metric !== event.metric) return item;
    const next = applyMetric(item.progress, def.target, event.amount);
    if (next.progress === item.progress) return item;
    changed = true;
    return {
      ...item,
      progress: next.progress,
      completed: next.completed,
    };
  });

  const currentMission = state.missions[state.missionsCleared];
  let missions = state.missions;
  if (currentMission && !currentMission.claimed) {
    let missionChanged = false;
    const progress = { ...currentMission.progress };
    for (const task of currentMission.tasks) {
      if (task.metric !== event.metric) continue;
      const prev = progress[task.id] ?? 0;
      if (prev >= task.target) continue;
      const next = applyMetric(prev, task.target, event.amount);
      if (next.progress !== prev) {
        progress[task.id] = next.progress;
        missionChanged = true;
      }
    }
    if (missionChanged) {
      const completed = currentMission.tasks.every(
        (task) => (progress[task.id] ?? 0) >= task.target,
      );
      missions = state.missions.map((round, index) =>
        index === state.missionsCleared
          ? { ...round, progress, completed }
          : round,
      );
      changed = true;
    }
  }

  if (!changed) return state;
  return syncMetaDailyQuests({ ...state, daily, missions, repeat });
}

export function claimDailyQuest(
  state: YanmarQuestState,
  questId: string,
): { state: YanmarQuestState; reward: QuestReward } | null {
  const def = DAILY_QUEST_DEFS.find((entry) => entry.id === questId);
  if (!def) return null;
  const item = state.daily.find((entry) => entry.id === questId);
  if (!item || !item.completed || item.claimed) return null;

  return {
    reward: def.reward,
    state: syncMetaDailyQuests({
      ...state,
      daily: state.daily.map((entry) =>
        entry.id === questId ? { ...entry, claimed: true } : entry,
      ),
    }),
  };
}

export function claimRepeatQuest(
  state: YanmarQuestState,
  questId: string,
): { state: YanmarQuestState; reward: QuestReward; claimIndex: number } | null {
  const def = REPEAT_QUEST_DEFS.find((entry) => entry.id === questId);
  if (!def) return null;
  const item = (state.repeat ?? []).find((entry) => entry.id === questId);
  if (!item || !item.completed) return null;

  const claimIndex = item.claimCount;
  return {
    reward: def.reward,
    claimIndex,
    state: {
      ...state,
      repeat: (state.repeat ?? []).map((entry) =>
        entry.id === questId
          ? {
              ...entry,
              progress: 0,
              completed: false,
              claimCount: entry.claimCount + 1,
            }
          : entry,
      ),
    },
  };
}

export function claimCurrentMission(
  state: YanmarQuestState,
): { state: YanmarQuestState; reward: QuestReward; roundIndex: number } | null {
  const round = state.missions[state.missionsCleared];
  if (!round || !round.completed || round.claimed) return null;

  const reward = MISSION_DIFFICULTY_REWARDS[round.difficulty];
  const missions = state.missions.map((item, index) =>
    index === state.missionsCleared ? { ...item, claimed: true } : item,
  );

  return {
    reward,
    roundIndex: round.index,
    state: syncMetaDailyQuests({
      ...state,
      missions,
      missionsCleared: Math.min(QUEST_MISSIONS_PER_DAY, state.missionsCleared + 1),
    }),
  };
}

export function getVisibleDailyQuests(level: number) {
  return DAILY_QUEST_DEFS.filter((def) => level >= def.minLevel);
}

export function getVisibleRepeatQuests(level: number) {
  return REPEAT_QUEST_DEFS.filter((def) => level >= def.minLevel);
}

export function getCurrentMission(state: YanmarQuestState) {
  if (state.missionsCleared >= QUEST_MISSIONS_PER_DAY) return null;
  return state.missions[state.missionsCleared] ?? null;
}

/** 탭 미수령(완료·미클릭) 보상 개수 */
export function countClaimableQuestRewards(state: YanmarQuestState | null): {
  daily: number;
  mission: number;
  repeat: number;
  total: number;
} {
  if (!state) {
    return { daily: 0, mission: 0, repeat: 0, total: 0 };
  }

  const daily = state.daily.filter((item) => item.completed && !item.claimed).length;
  const mission = (() => {
    const current = getCurrentMission(state);
    return current && current.completed && !current.claimed ? 1 : 0;
  })();
  const repeat = (state.repeat ?? []).filter((item) => item.completed).length;
  return { daily, mission, repeat, total: daily + mission + repeat };
}

export function questClaimEventId(
  kind: "daily" | "mission" | "repeat",
  dayKey: string,
  id: string,
) {
  return `quest:${kind}:${dayKey}:${id}`;
}
