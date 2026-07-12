"use client";

import { useState, type ReactNode } from "react";
import { MISSION_DIFFICULTY_REWARDS, QUEST_MISSIONS_PER_DAY } from "./quests/config";
import { getCurrentMission, type YanmarQuestState } from "./quests/questState";
import type { QuestReward } from "./quests/types";

interface MissionHudPanelProps {
  questState: YanmarQuestState | null;
  claiming: boolean;
  onClaim: () => void;
}

function DifficultyStars({ count }: { count: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-px" aria-label={`난이도 ${count}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`text-[8px] leading-none ${
            i < count ? "text-amber-300" : "text-white/20"
          }`}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function CompactQuestReward({ reward }: { reward: QuestReward }) {
  const parts: ReactNode[] = [];
  if (reward.xp > 0) {
    parts.push(
      <span key="xp" className="whitespace-nowrap tabular-nums">
        {reward.xp.toLocaleString()} EXP
      </span>,
    );
  }
  if (reward.stars > 0) {
    parts.push(
      <span
        key="stars"
        className="inline-flex items-center gap-0.5 whitespace-nowrap tabular-nums"
      >
        <img
          src="/images/star-currency.svg"
          alt=""
          width={10}
          height={10}
          className="yanmar-score-panel-star shrink-0"
          draggable={false}
        />
        {reward.stars.toLocaleString()}
      </span>,
    );
  }
  if ((reward.score ?? 0) > 0) {
    parts.push(
      <span key="score" className="whitespace-nowrap tabular-nums">
        {reward.score!.toLocaleString()}점
      </span>,
    );
  }
  if (parts.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-x-1 whitespace-nowrap">
      {parts.map((part, index) => (
        <span key={index} className="inline-flex items-center gap-1 whitespace-nowrap">
          {index > 0 ? <span className="text-amber-200/40">+</span> : null}
          {part}
        </span>
      ))}
    </span>
  );
}

function TaskProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="mt-0.5 h-0.5 overflow-hidden rounded-full bg-white/12">
      <div
        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-300 transition-[width] duration-200"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function MissionHudPanel({ questState, claiming, onClaim }: MissionHudPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (!questState) return null;

  const mission = getCurrentMission(questState);
  const headerLabel = mission
    ? `미션 ${mission.index + 1}/${QUEST_MISSIONS_PER_DAY}`
    : "미션 완료";

  return (
    <div className="yanmar-mission-hud-panel relative w-full overflow-visible rounded-xl border border-white/15 bg-black/60 text-white shadow-lg backdrop-blur-sm">
      <button
        type="button"
        className="flex h-6 w-full items-center justify-between gap-1 px-1.5 text-left hover:bg-white/8"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-label={expanded ? "미션 패널 접기" : "미션 패널 펼치기"}
      >
        <span className="min-w-0 overflow-hidden whitespace-nowrap text-[9px] font-black tabular-nums leading-none">
          {headerLabel}
        </span>
        <span className="inline-flex shrink-0 items-center gap-0.5">
          {mission ? <DifficultyStars count={mission.difficulty} /> : null}
          {mission?.completed && !mission.claimed ? (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
          ) : null}
          <span
            className={`text-[8px] leading-none text-white/55 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden
          >
            ▾
          </span>
        </span>
      </button>

      {expanded ? (
        <div className="absolute left-0 top-full z-20 mt-1 w-max min-w-full rounded-xl border border-white/15 bg-black/60 px-1.5 py-1.5 shadow-lg backdrop-blur-sm">
          {!mission ? (
            <p className="whitespace-nowrap text-center text-[8px] font-black text-emerald-200">
              미션 퀘스트 완료
            </p>
          ) : (
            <>
              <p className="whitespace-nowrap text-[8px] font-semibold leading-none text-amber-200/85">
                <CompactQuestReward reward={MISSION_DIFFICULTY_REWARDS[mission.difficulty]} />
              </p>
              <ul className="mt-1 space-y-1">
                {mission.tasks.map((task) => {
                  const value = mission.progress[task.id] ?? 0;
                  const done = value >= task.target;
                  return (
                    <li key={task.id}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="whitespace-nowrap text-[8px] font-bold leading-none text-white/90">
                          {task.required ? (
                            <span className="mr-0.5 text-[7px] font-black text-orange-300">
                              필수
                            </span>
                          ) : null}
                          {task.label}
                        </p>
                        <span
                          className={`shrink-0 whitespace-nowrap text-[7px] font-bold tabular-nums ${
                            done ? "text-emerald-300" : "text-white/50"
                          }`}
                        >
                          {done
                            ? `${task.target.toLocaleString()}/${task.target.toLocaleString()}`
                            : `${Math.floor(value).toLocaleString()}/${task.target.toLocaleString()}`}
                        </span>
                      </div>
                      <TaskProgressBar
                        value={done ? Math.max(value, task.target) : value}
                        max={task.target}
                      />
                    </li>
                  );
                })}
              </ul>
              {mission.completed && !mission.claimed ? (
                <button
                  type="button"
                  disabled={claiming}
                  onClick={onClaim}
                  className="mt-1.5 w-full whitespace-nowrap rounded border border-amber-300/40 bg-amber-500/90 py-0.5 text-[8px] font-black leading-none text-white disabled:opacity-60"
                >
                  {claiming ? "받는 중" : "보상 받기"}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
