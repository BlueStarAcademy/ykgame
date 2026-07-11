"use client";

import { useMemo, useState } from "react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import {
  MISSION_DIFFICULTY_REWARDS,
  QUEST_MISSIONS_PER_DAY,
  formatQuestReward,
} from "./quests/config";
import {
  getCurrentMission,
  getVisibleDailyQuests,
  type YanmarQuestState,
} from "./quests/questState";
import type { QuestTab } from "./quests/types";

interface QuestPanelProps {
  open: boolean;
  onClose: () => void;
  playerLevel: number;
  questState: YanmarQuestState | null;
  claimingId: string | null;
  onClaimDaily: (questId: string) => void;
  onClaimMission: () => void;
}

function DifficultyStars({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`난이도 ${count}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`text-[11px] leading-none ${
            i < count ? "text-amber-300" : "text-white/20"
          }`}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/12">
      <div
        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-300 transition-[width] duration-200"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

const TABS: { id: QuestTab; label: string }[] = [
  { id: "daily", label: "일일" },
  { id: "mission", label: "미션" },
  { id: "repeat", label: "반복" },
];

export function QuestPanel({
  open,
  onClose,
  playerLevel,
  questState,
  claimingId,
  onClaimDaily,
  onClaimMission,
}: QuestPanelProps) {
  const [tab, setTab] = useState<QuestTab>("daily");

  const dailyRows = useMemo(() => {
    if (!questState) return [];
    const defs = getVisibleDailyQuests(playerLevel);
    return defs.map((def) => {
      const progress = questState.daily.find((item) => item.id === def.id);
      return {
        def,
        progress: progress?.progress ?? 0,
        completed: progress?.completed ?? false,
        claimed: progress?.claimed ?? false,
      };
    });
  }, [playerLevel, questState]);

  const currentMission = questState ? getCurrentMission(questState) : null;
  const missionsDone = questState?.missionsCleared ?? 0;

  return (
    <AppModalOverlay open={open} onClose={onClose}>
      <div className="flex max-h-[min(92dvh,40rem)] w-full flex-col overflow-hidden rounded-2xl border border-amber-200/20 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl landscape:max-h-[min(94dvh,26rem)]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="yanmar-quest-panel-badge" aria-hidden />
            <div>
              <h2 className="text-sm font-black text-amber-100">퀘스트</h2>
              <p className="text-[10px] font-semibold text-white/45">
                Lv.{playerLevel} · 매일 자정(KST) 갱신
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[11px] font-bold text-white/70 hover:bg-white/10 hover:text-white"
          >
            닫기
          </button>
        </div>

        <div className="flex gap-1 border-b border-white/10 px-3 pt-2">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`relative flex-1 rounded-t-lg px-2 py-2 text-[11px] font-black transition ${
                  active
                    ? "bg-white/10 text-amber-100"
                    : "text-white/45 hover:bg-white/5 hover:text-white/75"
                }`}
              >
                {item.label}
                {active ? (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-amber-300" />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {tab === "daily" ? (
            <ul className="space-y-2">
              {dailyRows.map(({ def, progress, completed, claimed }) => {
                const claiming = claimingId === `daily:${def.id}`;
                return (
                  <li
                    key={def.id}
                    className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-white">{def.title}</p>
                        <p className="mt-0.5 text-[10px] font-semibold text-amber-200/80">
                          {formatQuestReward(def.reward)}
                        </p>
                      </div>
                      {claimed ? (
                        <span className="shrink-0 rounded-md bg-emerald-500/20 px-2 py-1 text-[10px] font-black text-emerald-200">
                          완료
                        </span>
                      ) : completed ? (
                        <button
                          type="button"
                          disabled={claiming}
                          onClick={() => onClaimDaily(def.id)}
                          className="shrink-0 rounded-md border border-amber-300/40 bg-amber-500/90 px-2.5 py-1 text-[10px] font-black text-white disabled:opacity-60"
                        >
                          {claiming ? "받는 중" : "보상"}
                        </button>
                      ) : (
                        <span className="shrink-0 text-[10px] font-bold tabular-nums text-white/55">
                          {Math.floor(progress).toLocaleString()}/
                          {def.target.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {!claimed ? (
                      <ProgressBar value={progress} max={def.target} />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {tab === "mission" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <span className="text-[11px] font-bold text-white/70">
                  오늘 미션 진행
                </span>
                <span className="text-[11px] font-black tabular-nums text-amber-100">
                  {missionsDone}/{QUEST_MISSIONS_PER_DAY}
                </span>
              </div>
              <ProgressBar value={missionsDone} max={QUEST_MISSIONS_PER_DAY} />

              {!currentMission ? (
                <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-6 text-center">
                  <p className="text-[12px] font-black text-emerald-100">
                    오늘의 미션 10회를 모두 완료했습니다.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200/20 bg-black/40 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-black text-white">
                        미션 {currentMission.index + 1}
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold text-amber-200/85">
                        {formatQuestReward(
                          MISSION_DIFFICULTY_REWARDS[currentMission.difficulty],
                        )}
                      </p>
                    </div>
                    <DifficultyStars count={currentMission.difficulty} />
                  </div>

                  <ul className="mt-3 space-y-2">
                    {currentMission.tasks.map((task) => {
                      const value = currentMission.progress[task.id] ?? 0;
                      const done = value >= task.target;
                      return (
                        <li
                          key={task.id}
                          className="rounded-lg border border-white/8 bg-white/5 px-2.5 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 text-[11px] font-bold text-white/90">
                              {task.required ? (
                                <span className="mr-1 text-[9px] font-black text-orange-300">
                                  필수
                                </span>
                              ) : null}
                              {task.label}
                            </p>
                            <span
                              className={`shrink-0 text-[10px] font-bold tabular-nums ${
                                done ? "text-emerald-300" : "text-white/50"
                              }`}
                            >
                              {done
                                ? "완료"
                                : `${Math.floor(value).toLocaleString()}/${task.target.toLocaleString()}`}
                            </span>
                          </div>
                          {!done ? (
                            <ProgressBar value={value} max={task.target} />
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>

                  {currentMission.completed && !currentMission.claimed ? (
                    <button
                      type="button"
                      disabled={claimingId === "mission"}
                      onClick={onClaimMission}
                      className="mt-3 w-full rounded-xl border border-amber-300/40 bg-amber-500/90 py-2.5 text-[12px] font-black text-white disabled:opacity-60"
                    >
                      {claimingId === "mission"
                        ? "보상 수령 중..."
                        : "미션 보상 받기"}
                    </button>
                  ) : (
                    <p className="mt-3 text-center text-[10px] font-semibold text-white/40">
                      모든 목표를 달성하면 다음 미션이 열립니다.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {tab === "repeat" ? (
            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-8 text-center">
              <p className="text-[12px] font-bold text-white/70">반복 퀘스트</p>
              <p className="mt-1.5 text-[11px] font-semibold text-white/40">
                준비 중입니다.
              </p>
            </div>
          ) : null}
        </div>

        <div className="border-t border-white/10 px-4 py-2 text-[9px] font-semibold text-white/35">
          보상은 스타와 EXP로 지급됩니다.
        </div>
      </div>
    </AppModalOverlay>
  );
}
