"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import {
  MISSION_DIFFICULTY_REWARDS,
  QUEST_MISSIONS_PER_DAY,
} from "./quests/config";
import {
  countClaimableQuestRewards,
  formatQuestResetCountdown,
  getCurrentMission,
  getMsUntilNextQuestReset,
  getVisibleDailyQuests,
  getVisibleRepeatQuests,
  type YanmarQuestState,
} from "./quests/questState";
import type { QuestReward, QuestTab } from "./quests/types";

function QuestNotifyBadge({
  count,
  className = "",
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={`yanmar-quest-notify-badge ${className}`.trim()}
      aria-label={`미수령 보상 ${count}개`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
function QuestRewardDisplay({
  reward,
  layout = "inline",
}: {
  reward: QuestReward;
  layout?: "inline" | "grid";
}) {
  const parts: { key: string; node: ReactNode }[] = [];
  if (reward.xp > 0) {
    parts.push({
      key: "xp",
      node: (
        <span className="tabular-nums">{reward.xp.toLocaleString()} EXP</span>
      ),
    });
  }
  if (reward.stars > 0) {
    parts.push({
      key: "stars",
      node: (
        <>
          <img
            src="/images/star-currency.svg"
            alt=""
            width={12}
            height={12}
            className="yanmar-quest-reward-icon yanmar-score-panel-star"
            draggable={false}
          />
          <span className="tabular-nums">{reward.stars.toLocaleString()}</span>
        </>
      ),
    });
  }
  if ((reward.score ?? 0) > 0) {
    parts.push({
      key: "score",
      node: (
        <span className="tabular-nums">
          {reward.score!.toLocaleString()}점
        </span>
      ),
    });
  }
  if ((reward.enhanceCores ?? 0) > 0) {
    parts.push({
      key: "cores",
      node: (
        <>
          <img
            src="/images/yanmar/2d/enhance-core.png?v=3"
            alt=""
            width={12}
            height={12}
            className="yanmar-quest-reward-icon"
            draggable={false}
          />
          <span className="tabular-nums">
            {reward.enhanceCores!.toLocaleString()}
          </span>
        </>
      ),
    });
  }
  if ((reward.gachaTicketsStandard ?? 0) > 0) {
    parts.push({
      key: "ticket-std",
      node: (
        <>
          <img
            src="/images/yanmar/2d/gacha-ticket-standard.svg"
            alt=""
            width={12}
            height={12}
            className="yanmar-quest-reward-icon"
            draggable={false}
          />
          <span className="tabular-nums">
            {reward.gachaTicketsStandard!.toLocaleString()}
          </span>
        </>
      ),
    });
  }
  if ((reward.gachaTicketsPremium ?? 0) > 0) {
    parts.push({
      key: "ticket-prem",
      node: (
        <>
          <img
            src="/images/yanmar/2d/gacha-ticket-premium.svg"
            alt=""
            width={12}
            height={12}
            className="yanmar-quest-reward-icon"
            draggable={false}
          />
          <span className="tabular-nums">
            {reward.gachaTicketsPremium!.toLocaleString()}
          </span>
        </>
      ),
    });
  }
  if (parts.length === 0) {
    return <span>보상 없음</span>;
  }
  if (layout === "grid") {
    return (
      <span className="yanmar-quest-reward-grid">
        {parts.map((part) => (
          <span key={part.key} className="yanmar-quest-reward-cell">
            {part.node}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className="yanmar-quest-reward-inline">
      {parts.map((part, index) => (
        <span key={part.key} className="yanmar-quest-reward-inline-item">
          {index > 0 ? (
            <span className="yanmar-quest-reward-sep" aria-hidden>
              +
            </span>
          ) : null}
          <span className="yanmar-quest-reward-cell">{part.node}</span>
        </span>
      ))}
    </span>
  );
}
interface QuestPanelProps {
  open: boolean;
  onClose: () => void;
  playerLevel: number;
  questState: YanmarQuestState | null;
  claimingId: string | null;
  onClaimDaily: (questId: string) => void;
  onClaimMission: () => void;
  onClaimRepeat: (questId: string) => void;
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

function ProgressBar({
  value,
  max,
  className = "",
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      className={`h-1.5 overflow-hidden rounded-full bg-white/12 ${className}`.trim()}
    >
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
  onClaimRepeat,
}: QuestPanelProps) {
  const [tab, setTab] = useState<QuestTab>("daily");
  const [resetCountdown, setResetCountdown] = useState(() =>
    formatQuestResetCountdown(getMsUntilNextQuestReset()),
  );

  useEffect(() => {
    if (!open) return;
    const tick = () => {
      setResetCountdown(formatQuestResetCountdown(getMsUntilNextQuestReset()));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [open]);

  const dailyRows = useMemo(() => {
    if (!questState) return [];
    const defs = getVisibleDailyQuests(playerLevel);
    return defs.map((def) => {
      const progress = questState.daily.find((item) => item.id === def.id);
      const target =
        progress?.target && progress.target > 0
          ? progress.target
          : typeof def.target === "number"
            ? def.target
            : def.target.min;
      return {
        def,
        target,
        title: def.title(target),
        progress: progress?.progress ?? 0,
        completed: progress?.completed ?? false,
        claimed: progress?.claimed ?? false,
      };
    });
  }, [playerLevel, questState]);

  const repeatRows = useMemo(() => {
    if (!questState) return [];
    const defs = getVisibleRepeatQuests(playerLevel);
    return defs.map((def) => {
      const progress = (questState.repeat ?? []).find((item) => item.id === def.id);
      return {
        def,
        progress: progress?.progress ?? 0,
        completed: progress?.completed ?? false,
        claimCount: progress?.claimCount ?? 0,
      };
    });
  }, [playerLevel, questState]);

  const currentMission = questState ? getCurrentMission(questState) : null;
  const missionsDone = questState?.missionsCleared ?? 0;
  const claimable = useMemo(
    () => countClaimableQuestRewards(questState),
    [questState],
  );

  return (
    <AppModalOverlay open={open} onClose={onClose}>
      <div className="flex h-[min(82dvh,36rem)] w-full flex-col overflow-hidden rounded-2xl border border-amber-200/20 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl landscape:h-[min(90dvh,22rem)]">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="yanmar-quest-panel-badge" aria-hidden />
            <h2 className="text-sm font-black text-amber-100">퀘스트</h2>
            <span
              className="text-[10px] font-bold tabular-nums text-white/55"
              title="일일 퀘스트 초기화까지 남은 시간"
            >
              초기화 {resetCountdown}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[11px] font-bold text-white/70 hover:bg-white/10 hover:text-white"
          >
            닫기
          </button>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-white/10 px-3 pt-2">
          {TABS.map((item) => {
            const active = tab === item.id;
            const badgeCount = claimable[item.id];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`relative flex flex-1 items-center justify-center gap-1 rounded-t-lg px-2 py-2 text-[11px] font-black transition ${
                  active
                    ? "bg-white/10 text-amber-100"
                    : "text-white/45 hover:bg-white/5 hover:text-white/75"
                }`}
              >
                <span>{item.label}</span>
                <QuestNotifyBadge count={badgeCount} className="is-tab" />
                {active ? (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-amber-300" />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 [-webkit-overflow-scrolling:touch]">
          {tab === "daily" ? (
            <ul className="space-y-2">
              {dailyRows.map(({ def, title, target, progress, completed, claimed }) => {
                const claiming = claimingId === `daily:${def.id}`;
                return (
                  <li
                    key={def.id}
                    className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-[12px] font-bold text-white">
                        {title}
                      </p>
                      <p className="shrink-0 text-[10px] font-semibold text-amber-200/80">
                        <QuestRewardDisplay reward={def.reward} />
                      </p>
                    </div>
                    <div className="mt-1.5 flex min-w-0 items-center gap-2">
                      <ProgressBar
                        value={
                          claimed || completed
                            ? Math.max(progress, target)
                            : progress
                        }
                        max={target}
                        className="min-w-0 flex-1"
                      />
                      {claimed ? (
                        <span className="shrink-0 text-[10px] font-bold tabular-nums text-emerald-300">
                          {target.toLocaleString()}/{target.toLocaleString()}
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
                          {target.toLocaleString()}
                        </span>
                      )}
                    </div>
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
              <div className="flex items-center gap-2 px-0.5">
                <ProgressBar
                  value={missionsDone}
                  max={QUEST_MISSIONS_PER_DAY}
                  className="min-w-0 flex-1"
                />
              </div>

              {!currentMission ? (
                <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-6 text-center">
                  <p className="text-[12px] font-black text-emerald-100">
                    미션 퀘스트 완료
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200/20 bg-black/40 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <DifficultyStars count={currentMission.difficulty} />
                    <span className="text-[10px] font-bold text-amber-200/55">
                      보상
                    </span>
                  </div>
                  <div className="mt-2 rounded-lg border border-amber-200/10 bg-black/25 px-2.5 py-2">
                    <QuestRewardDisplay
                      layout="grid"
                      reward={
                        MISSION_DIFFICULTY_REWARDS[currentMission.difficulty]
                      }
                    />
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
                          <div className="flex min-w-0 items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-[11px] font-bold text-white/90">
                              {task.required ? (
                                <span className="mr-1 text-[9px] font-black text-orange-300">
                                  필수
                                </span>
                              ) : null}
                              {task.label}
                            </p>
                          </div>
                          <div className="mt-1.5 flex min-w-0 items-center gap-2">
                            <ProgressBar
                              value={done ? Math.max(value, task.target) : value}
                              max={task.target}
                              className="min-w-0 flex-1"
                            />
                            <span
                              className={`shrink-0 text-[10px] font-bold tabular-nums ${
                                done ? "text-emerald-300" : "text-white/50"
                              }`}
                            >
                              {done
                                ? `${task.target.toLocaleString()}/${task.target.toLocaleString()}`
                                : `${Math.floor(value).toLocaleString()}/${task.target.toLocaleString()}`}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {currentMission.completed && !currentMission.claimed ? (
                    <button
                      type="button"
                      disabled={claimingId === "mission"}
                      onClick={onClaimMission}
                      className="mt-3 w-full rounded-xl border border-amber-300/40 bg-amber-500/90 px-3 py-2.5 text-[12px] font-black text-white disabled:opacity-60"
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
            <ul className="space-y-2">
              {repeatRows.map(({ def, progress, completed, claimCount }) => {
                const claiming = claimingId === `repeat:${def.id}`;
                return (
                  <li
                    key={def.id}
                    className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-[12px] font-bold text-white">
                        {def.title}
                      </p>
                      <p className="shrink-0 text-[10px] font-semibold text-amber-200/80">
                        <QuestRewardDisplay reward={def.reward} />
                        {claimCount > 0 ? (
                          <span className="ml-1.5 text-white/35">
                            · {claimCount}회 수령
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="mt-1.5 flex min-w-0 items-center gap-2">
                      <ProgressBar
                        value={progress}
                        max={def.target}
                        className="min-w-0 flex-1"
                      />
                      {completed ? (
                        <button
                          type="button"
                          disabled={claiming}
                          onClick={() => onClaimRepeat(def.id)}
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
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </AppModalOverlay>
  );
}
