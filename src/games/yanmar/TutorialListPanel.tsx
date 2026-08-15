"use client";

import { useTranslations } from "next-intl";
import { GearIconCell } from "./GearIconCell";
import {
  TUTORIAL_STEPS,
  isTutorialStepUnlocked,
  type TutorialStep,
  type TutorialStepId,
} from "./tutorial";
import {
  isCurrencyTutorialReward,
  isGearTutorialReward,
  type TutorialRewardDef,
  type YanmarTutorialState,
} from "./tutorialProgress";

const CORE_ICON = "/images/yanmar/2d/enhance-core.png?v=3";
const TICKET_STANDARD_ICON = "/images/yanmar/2d/gacha-ticket-standard.svg";
const TICKET_PREMIUM_ICON = "/images/yanmar/2d/gacha-ticket-premium.svg";
const STAR_ICON = "/images/star-currency.svg";
/** 보상 아이콘 테두리(둥근 사각형) — 빛이 이 경로를 따라 한 바퀴 돈다. */
const REWARD_RING_PATH =
  "M13 2H87A11 11 0 0 1 98 13V87A11 11 0 0 1 87 98H13A11 11 0 0 1 2 87V13A11 11 0 0 1 13 2Z";

function TutorialRewardVisual({ reward }: { reward: TutorialRewardDef }) {
  if (isGearTutorialReward(reward)) {
    return (
      <GearIconCell
        slot={reward.slot}
        grade={reward.grade}
        size="sm"
      />
    );
  }

  if (!isCurrencyTutorialReward(reward)) return null;

  const amount =
    reward.stars ??
    reward.enhanceCores ??
    reward.gachaTicketsStandard ??
    reward.gachaTicketsPremium ??
    0;
  const src = reward.stars
    ? STAR_ICON
    : reward.enhanceCores
      ? CORE_ICON
      : reward.gachaTicketsPremium
        ? TICKET_PREMIUM_ICON
        : TICKET_STANDARD_ICON;

  return (
    <span className="yanmar-tutorial-list-currency-reward">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} decoding="async" />
      {amount > 0 ? <em>×{amount}</em> : null}
    </span>
  );
}

export function TutorialListPanel({
  open,
  playerLevel,
  tutorial,
  activeId,
  claimingId,
  showSkip,
  hideClose,
  onSelect,
  onClaim,
  onSkip,
  onClose,
}: {
  open: boolean;
  playerLevel: number;
  tutorial: YanmarTutorialState;
  activeId: TutorialStepId | null;
  claimingId?: TutorialStepId | null;
  showSkip: boolean;
  hideClose?: boolean;
  onSelect: (index: number, step: TutorialStep) => void;
  onClaim: (stepId: TutorialStepId) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("yanmar.tutorial");

  if (!open) return null;

  return (
    <div className="yanmar-tutorial-list" role="dialog" aria-label={t("ariaLabel")}>
      <div className="yanmar-tutorial-list-head">
        <p className="yanmar-tutorial-list-kicker">TUTORIAL</p>
        <h2>{t("title")}</h2>
        {!hideClose ? (
          <button
            type="button"
            className="yanmar-tutorial-list-close"
            onClick={onClose}
          >
            {t("close")}
          </button>
        ) : null}
      </div>
      <ol className="yanmar-tutorial-list-items">
        {TUTORIAL_STEPS.map((step, index) => {
          const unlocked = isTutorialStepUnlocked(step, playerLevel);
          const completed = tutorial.completed.includes(step.id);
          const claimed = tutorial.claimed.includes(step.id);
          const isNew =
            unlocked &&
            step.unlockLevel > 1 &&
            !tutorial.seenNew.includes(step.id);
          const reward = step.reward;
          const active = activeId === step.id;
          const canClaim = Boolean(reward) && completed && !claimed;
          const doneMark = claimed || (completed && !reward);
          return (
            <li key={step.id}>
              <div
                className={`yanmar-tutorial-list-row${
                  active ? " is-active" : ""
                }${completed ? " is-done" : ""}${
                  claimed ? " is-claimed" : ""
                }${unlocked ? "" : " is-locked"}`}
              >
                <button
                  type="button"
                  disabled={!unlocked}
                  onClick={() => {
                    if (!unlocked) return;
                    onSelect(index, step);
                  }}
                  className="yanmar-tutorial-list-select"
                >
                  <span
                    className={`yanmar-tutorial-list-index${
                      doneMark ? " is-checked" : ""
                    }`}
                    aria-hidden={doneMark}
                  >
                    {doneMark ? "✓" : index + 1}
                  </span>
                  <span className="yanmar-tutorial-list-copy">
                    <span className="yanmar-tutorial-list-title">
                      {t(`steps.${step.id}.title`)}
                      {isNew ? (
                        <em className="yanmar-tutorial-list-new">{t("new")}</em>
                      ) : null}
                    </span>
                    <span className="yanmar-tutorial-list-desc">
                      {unlocked
                        ? t(`steps.${step.id}.instruction`)
                        : t("unlockLevel", { level: step.unlockLevel })}
                    </span>
                  </span>
                </button>
                {reward ? (
                  canClaim ? (
                    <button
                      type="button"
                      className="yanmar-tutorial-list-reward is-ready"
                      disabled={claimingId === step.id}
                      onClick={() => onClaim(step.id)}
                      aria-label={
                        claimingId === step.id
                          ? t("claiming")
                          : t("claimReward")
                      }
                    >
                      <TutorialRewardVisual reward={reward} />
                      <svg
                        className="yanmar-tutorial-list-reward-trace"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        aria-hidden
                      >
                        <path
                          className="is-track"
                          d={REWARD_RING_PATH}
                          pathLength={100}
                        />
                        <path
                          className="is-beam"
                          d={REWARD_RING_PATH}
                          pathLength={100}
                        />
                      </svg>
                      <span className="yanmar-tutorial-list-reward-mark is-claim">
                        {claimingId === step.id ? t("claiming") : t("claim")}
                      </span>
                    </button>
                  ) : (
                    <span
                      className={`yanmar-tutorial-list-reward${
                        claimed ? " is-claimed" : ""
                      }`}
                      aria-label={
                        claimed ? t("claimed") : t("completionReward")
                      }
                    >
                      <TutorialRewardVisual reward={reward} />
                      {claimed ? (
                        <span
                          className="yanmar-tutorial-list-reward-mark is-done"
                          aria-hidden
                        >
                          ✓
                        </span>
                      ) : null}
                    </span>
                  )
                ) : null}
                {!unlocked ? (
                  <span className="yanmar-tutorial-list-lock">
                    Lv.{step.unlockLevel}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {showSkip ? (
        <button
          type="button"
          className="yanmar-tutorial-list-skip"
          onClick={onSkip}
        >
          {t("skipToGame")}
        </button>
      ) : null}
    </div>
  );
}
