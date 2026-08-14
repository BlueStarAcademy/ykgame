"use client";

import { useTranslations } from "next-intl";
import { GearIconCell } from "./GearIconCell";
import {
  TUTORIAL_STEPS,
  isTutorialStepUnlocked,
  type TutorialStep,
  type TutorialStepId,
} from "./tutorial";
import type { YanmarTutorialState } from "./tutorialProgress";

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
          return (
            <li key={step.id}>
              <button
                type="button"
                disabled={!unlocked}
                onClick={() => {
                  if (!unlocked) return;
                  onSelect(index, step);
                }}
                className={`yanmar-tutorial-list-row${
                  active ? " is-active" : ""
                }${completed ? " is-done" : ""}${
                  unlocked ? "" : " is-locked"
                }`}
              >
                <span className="yanmar-tutorial-list-index">
                  {index + 1}
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
                {reward ? (
                  <span
                    className={`yanmar-tutorial-list-reward${
                      claimed ? " is-claimed" : ""
                    }${completed && !claimed ? " is-ready" : ""}`}
                    onClick={(event) => {
                      if (!completed || claimed) return;
                      event.preventDefault();
                      event.stopPropagation();
                      onClaim(step.id);
                    }}
                    role={completed && !claimed ? "button" : undefined}
                    aria-label={
                      claimed
                        ? t("claimed")
                        : completed
                          ? claimingId === step.id
                            ? t("claiming")
                            : t("claimReward")
                          : t("completionReward")
                    }
                  >
                    <GearIconCell
                      slot={reward.slot}
                      grade={reward.grade}
                      size="sm"
                    />
                    {completed && !claimed ? (
                      <span className="yanmar-tutorial-list-claim">{t("claim")}</span>
                    ) : null}
                  </span>
                ) : null}
                {!unlocked ? (
                  <span className="yanmar-tutorial-list-lock">
                    Lv.{step.unlockLevel}
                  </span>
                ) : null}
              </button>
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
