"use client";

import type { ReactNode } from "react";
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
    <span className="inline-flex items-center gap-px" aria-label={`난이도 ${count}`}>
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
      <span key="xp" className="tabular-nums">
        {reward.xp.toLocaleString()} EXP
      </span>,
    );
  }
  if (reward.stars > 0) {
    parts.push(
      <span key="stars" className="inline-flex items-center gap-0.5 tabular-nums">
        <img
          src="/images/star-currency.svg"
          alt=""
          width={12}
          height={12}
          className="yanmar-score-panel-star"
          draggable={false}
        />
        {reward.stars.toLocaleString()}
      </span>,
    );
  }
  if (parts.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
      {parts.map((part, index) => (
        <span key={index} className="inline-flex items-center gap-1">
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
    <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/12">
      <div
        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-300 transition-[width] duration-200"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function MissionHudPanel({ questState, claiming, onClaim }: MissionHudPanelProps) {
  if (!questState) return null;

  const mission = getCurrentMission(questState);

  const panelClass =
    "yanmar-mission-hud-panel pointer-events-auto w-[10.5rem] rounded-sm border border-white/10 bg-black/55 px-2 py-1.5 text-white shadow-xl backdrop-blur-sm";

  if (!mission) {
    return (
      <div className={panelClass}>
        <p className="text-center text-[10px] font-black text-emerald-200">미션 퀘스트 완료</p>
      </div>
    );
  }

  const reward = MISSION_DIFFICULTY_REWARDS[mission.difficulty];

  return (
    <div className={panelClass}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] font-black tabular-nums">
          미션 {mission.index + 1}/{QUEST_MISSIONS_PER_DAY}
        </span>
        <DifficultyStars count={mission.difficulty} />
      </div>
      <p className="mt-0.5 text-[8px] font-semibold text-amber-200/85">
        <CompactQuestReward reward={reward} />
      </p>
      <ul className="mt-1 space-y-1">
        {mission.tasks.map((task) => {
          const value = mission.progress[task.id] ?? 0;
          const done = value >= task.target;
          return (
            <li key={task.id}>
              <div className="flex items-center justify-between gap-1">
                <p className="min-w-0 flex-1 truncate text-[8px] font-bold leading-tight text-white/90">
                  {task.required ? (
                    <span className="mr-0.5 text-[7px] font-black text-orange-300">필수</span>
                  ) : null}
                  {task.label}
                </p>
                <span
                  className={`shrink-0 text-[7px] font-bold tabular-nums ${
                    done ? "text-emerald-300" : "text-white/50"
                  }`}
                >
                  {done
                    ? "완료"
                    : `${Math.floor(value).toLocaleString()}/${task.target.toLocaleString()}`}
                </span>
              </div>
              {!done ? <TaskProgressBar value={value} max={task.target} /> : null}
            </li>
          );
        })}
      </ul>
      {mission.completed && !mission.claimed ? (
        <button
          type="button"
          disabled={claiming}
          onClick={onClaim}
          className="mt-1.5 w-full rounded-md border border-amber-300/40 bg-amber-500/90 py-1 text-[9px] font-black text-white disabled:opacity-60"
        >
          {claiming ? "받는 중" : "완료"}
        </button>
      ) : !mission.completed ? (
        <p className="mt-1 text-center text-[7px] text-white/35">목표 달성 시 완료</p>
      ) : null}
    </div>
  );
}
