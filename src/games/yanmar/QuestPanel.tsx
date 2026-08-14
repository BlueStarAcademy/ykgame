"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import {
  isMetaDailyQuest,
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
import type { QuestTab } from "./quests/types";
import {
  ClaimButton,
  DoneStamp,
  PendingStamp,
  QuestCard,
  QuestRewardTiles,
  type QuestCardState,
} from "./QuestCardUI";

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

function ClockGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 7.5V12l3 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

const TABS: { id: QuestTab; label: string }[] = [
  { id: "daily", label: "일일" },
  { id: "mission", label: "미션" },
  { id: "repeat", label: "반복" },
];

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
  const t = useTranslations("yanmar.quest");
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
        title: t(`defs.${def.id}`, { target }),
        progress: progress?.progress ?? 0,
        completed: progress?.completed ?? false,
        claimed: progress?.claimed ?? false,
      };
    });
  }, [playerLevel, questState, t]);

  const repeatRows = useMemo(() => {
    if (!questState) return [];
    const defs = getVisibleRepeatQuests(playerLevel);
    return defs.map((def) => {
      const progress = (questState.repeat ?? []).find((item) => item.id === def.id);
      return {
        def,
        title: t(`defs.${def.id}`, { target: def.target }),
        progress: progress?.progress ?? 0,
        completed: progress?.completed ?? false,
        claimCount: progress?.claimCount ?? 0,
      };
    });
  }, [playerLevel, questState, t]);

  const currentMission = questState ? getCurrentMission(questState) : null;
  const missionsDone = questState?.missionsCleared ?? 0;
  const claimable = useMemo(
    () => countClaimableQuestRewards(questState),
    [questState],
  );
  const totalClaimable =
    claimable.daily + claimable.mission + claimable.repeat;
  const dailyClaimed = dailyRows.filter((row) => row.claimed).length;
  const repeatClaimedToday = repeatRows.reduce(
    (sum, row) => sum + row.claimCount,
    0,
  );

  return (
    <AppModalOverlay
      open={open}
      onClose={onClose}
      panelClassName="yanmar-quest-modal-shell"
    >
      <div className="yanmar-quest-modal">
        <header className="yanmar-quest-modal-head">
          <span className="yanmar-quest-modal-emblem" aria-hidden>
            <img
              src="/images/yanmar/2d/cockpit/quest-premium.png?v=3"
              alt=""
              draggable={false}
            />
          </span>
          <div className="yanmar-quest-modal-titles">
            <p className="yanmar-quest-modal-eyebrow">YANMAR FIELD LOG</p>
            <h2>{t("title")}</h2>
          </div>
          <div className="yanmar-quest-modal-head-meta">
            {totalClaimable > 0 ? (
              <span
                className="yanmar-quest-modal-chip is-alert"
                title="수령 대기 중인 보상"
              >
                보상 <b className="tabular-nums">{totalClaimable}</b>
              </span>
            ) : null}
            <span
              className="yanmar-quest-modal-chip"
              title="일일 퀘스트 초기화까지 남은 시간"
            >
              <ClockGlyph />
              초기화 <b className="tabular-nums">{resetCountdown}</b>
            </span>
            <button
              type="button"
              className="yanmar-quest-modal-close"
              onClick={onClose}
              aria-label="퀘스트 닫기"
            >
              <CloseGlyph />
            </button>
          </div>
        </header>

        <div className="yanmar-quest-modal-tabs" role="tablist">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={`yanmar-quest-tab${active ? " is-active" : ""}`}
              >
                <span>{item.label}</span>
                <QuestNotifyBadge count={claimable[item.id]} className="is-tab" />
              </button>
            );
          })}
        </div>

        {tab === "daily" ? (
          <div className="yanmar-quest-modal-rail">
            <span className="yanmar-quest-modal-rail-label">오늘 달성</span>
            <span className="yanmar-quest-pips" aria-hidden>
              {dailyRows.map((row) => (
                <span
                  key={row.def.id}
                  className={`yanmar-quest-pip${row.claimed ? " is-on" : ""}`}
                />
              ))}
            </span>
            <span className="yanmar-quest-modal-rail-value tabular-nums">
              <b>{dailyClaimed}</b> / {dailyRows.length}
            </span>
          </div>
        ) : null}

        {tab === "mission" ? (
          <div className="yanmar-quest-modal-rail">
            <span className="yanmar-quest-modal-rail-label">미션 진행</span>
            <span className="yanmar-quest-pips" aria-hidden>
              {Array.from({ length: QUEST_MISSIONS_PER_DAY }, (_, i) => (
                <span
                  key={i}
                  className={`yanmar-quest-pip${i < missionsDone ? " is-on" : ""}`}
                />
              ))}
            </span>
            <span className="yanmar-quest-modal-rail-value tabular-nums">
              <b>{missionsDone}</b> / {QUEST_MISSIONS_PER_DAY}
            </span>
          </div>
        ) : null}

        {tab === "repeat" ? (
          <div className="yanmar-quest-modal-rail">
            <span className="yanmar-quest-modal-rail-label">반복 퀘스트</span>
            <span className="yanmar-quest-modal-rail-note">
              완료할 때마다 다시 도전할 수 있습니다
            </span>
            <span className="yanmar-quest-modal-rail-value tabular-nums">
              오늘 <b>{repeatClaimedToday}</b>회 수령
            </span>
          </div>
        ) : null}

        <div className="yanmar-quest-modal-body">
          {!questState ? (
            <div className="yanmar-quest-empty">
              <p className="yanmar-quest-empty-title">
                퀘스트 정보를 불러오는 중입니다
              </p>
              <p className="yanmar-quest-empty-sub">
                잠시 후 다시 확인해 주세요.
              </p>
            </div>
          ) : null}

          {questState && tab === "daily" ? (
            <ul className="yanmar-quest-list">
              {dailyRows.map(
                ({ def, title, target, progress, completed, claimed }) => {
                  const claiming = claimingId === `daily:${def.id}`;
                  const state: QuestCardState = claimed
                    ? "done"
                    : completed
                      ? "claimable"
                      : "active";
                  return (
                    <QuestCard
                      key={def.id}
                      title={title}
                      tag={
                        isMetaDailyQuest(def)
                          ? { label: "보너스", tone: "bonus" }
                          : undefined
                      }
                      reward={def.reward}
                      value={progress}
                      target={target}
                      metric={def.metric}
                      state={state}
                      action={
                        claimed ? (
                          <DoneStamp />
                        ) : completed ? (
                          <ClaimButton
                            claiming={claiming}
                            onClaim={() => onClaimDaily(def.id)}
                          />
                        ) : (
                          <PendingStamp />
                        )
                      }
                    />
                  );
                },
              )}
            </ul>
          ) : null}

          {questState && tab === "mission" ? (
            !currentMission ? (
              <div className="yanmar-quest-empty is-clear">
                <p className="yanmar-quest-empty-title">
                  오늘의 미션 퀘스트를 모두 완료했습니다
                </p>
                <p className="yanmar-quest-empty-sub">
                  초기화 후 새로운 미션이 배정됩니다.
                </p>
              </div>
            ) : (
              <div className="yanmar-quest-mission">
                <div className="yanmar-quest-mission-head">
                  <span className="yanmar-quest-mission-difficulty">
                    <span className="yanmar-quest-mission-label">난이도</span>
                    <span
                      className="yanmar-quest-mission-stars"
                      aria-label={`난이도 ${currentMission.difficulty}`}
                    >
                      {Array.from({ length: 5 }, (_, i) => (
                        <span
                          key={i}
                          className={`yanmar-quest-mission-star${
                            i < currentMission.difficulty ? " is-on" : ""
                          }`}
                          aria-hidden
                        >
                          ★
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="yanmar-quest-modal-rail-value tabular-nums">
                    ROUND <b>{Math.min(missionsDone + 1, QUEST_MISSIONS_PER_DAY)}</b>
                  </span>
                </div>

                <p className="yanmar-quest-section-label">클리어 보상</p>
                <QuestRewardTiles
                  reward={MISSION_DIFFICULTY_REWARDS[currentMission.difficulty]}
                />

                <p className="yanmar-quest-section-label">목표</p>
                <ul className="yanmar-quest-list">
                  {currentMission.tasks.map((task) => {
                    const value = currentMission.progress[task.id] ?? 0;
                    const done = value >= task.target;
                    return (
                      <QuestCard
                        key={task.id}
                        title={task.label}
                        tag={
                          task.required
                            ? { label: "필수", tone: "required" }
                            : { label: "선택", tone: "bonus" }
                        }
                        value={value}
                        target={task.target}
                        metric={task.metric}
                        state={done ? "done" : "active"}
                      />
                    );
                  })}
                </ul>

                {currentMission.completed && !currentMission.claimed ? (
                  <button
                    type="button"
                    className="yanmar-quest-claim"
                    disabled={claimingId === "mission"}
                    onClick={onClaimMission}
                  >
                    {claimingId === "mission"
                      ? "보상 수령 중..."
                      : "미션 보상 받기"}
                  </button>
                ) : (
                  <p className="yanmar-quest-mission-footer">
                    모든 목표를 달성하면 다음 미션이 열립니다.
                  </p>
                )}
              </div>
            )
          ) : null}

          {questState && tab === "repeat" ? (
            <ul className="yanmar-quest-list">
              {repeatRows.map(({ def, title, progress, completed, claimCount }) => {
                const claiming = claimingId === `repeat:${def.id}`;
                return (
                  <QuestCard
                    key={def.id}
                    title={title}
                    reward={def.reward}
                    meta={
                      claimCount > 0 ? `오늘 ${claimCount}회 수령` : undefined
                    }
                    value={progress}
                    target={def.target}
                    metric={def.metric}
                    state={completed ? "claimable" : "active"}
                    action={
                      completed ? (
                        <ClaimButton
                          claiming={claiming}
                          onClaim={() => onClaimRepeat(def.id)}
                        />
                      ) : (
                        <PendingStamp />
                      )
                    }
                  />
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </AppModalOverlay>
  );
}
