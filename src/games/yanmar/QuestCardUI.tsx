"use client";

import {
  type CSSProperties,
  type ReactNode,
} from "react";
import type { QuestMetric, QuestReward } from "./quests/types";
import { formatQuestProgressCurrent } from "./quests/formatProgress";

export function CheckGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type RewardEntry = {
  key: string;
  tone: string;
  label: string;
  amount: string;
  icon: ReactNode;
  tile: ReactNode;
};

function rewardImage(src: string, alt: string, extraClass = "") {
  return (
    <img
      src={src}
      alt={alt}
      className={`yanmar-quest-reward-icon ${extraClass}`.trim()}
      draggable={false}
    />
  );
}

function buildRewardEntries(reward: QuestReward): RewardEntry[] {
  const entries: RewardEntry[] = [];
  if (reward.xp > 0) {
    entries.push({
      key: "xp",
      tone: "is-xp",
      label: "경험치",
      amount: reward.xp.toLocaleString(),
      icon: <span className="yanmar-quest-chip-glyph">XP</span>,
      tile: <span className="yanmar-quest-reward-tile-glyph">XP</span>,
    });
  }
  if (reward.stars > 0) {
    entries.push({
      key: "stars",
      tone: "is-star",
      label: "스타",
      amount: reward.stars.toLocaleString(),
      icon: rewardImage("/images/star-currency.svg", "", "yanmar-score-panel-star"),
      tile: rewardImage(
        "/images/star-currency.svg",
        "",
        "is-lg yanmar-score-panel-star",
      ),
    });
  }
  if ((reward.score ?? 0) > 0) {
    entries.push({
      key: "score",
      tone: "is-score",
      label: "점수",
      amount: reward.score!.toLocaleString(),
      icon: <span className="yanmar-quest-chip-glyph">PT</span>,
      tile: <span className="yanmar-quest-reward-tile-glyph">PT</span>,
    });
  }
  if ((reward.enhanceCores ?? 0) > 0) {
    entries.push({
      key: "cores",
      tone: "is-core",
      label: "강화코어",
      amount: reward.enhanceCores!.toLocaleString(),
      icon: rewardImage("/images/yanmar/2d/enhance-core.png?v=3", ""),
      tile: rewardImage("/images/yanmar/2d/enhance-core.png?v=3", "", "is-lg"),
    });
  }
  if ((reward.gachaTicketsStandard ?? 0) > 0) {
    entries.push({
      key: "ticket-std",
      tone: "is-ticket",
      label: "일반 뽑기권",
      amount: reward.gachaTicketsStandard!.toLocaleString(),
      icon: rewardImage("/images/yanmar/2d/gacha-ticket-standard.svg", ""),
      tile: rewardImage("/images/yanmar/2d/gacha-ticket-standard.svg", "", "is-lg"),
    });
  }
  if ((reward.gachaTicketsPremium ?? 0) > 0) {
    entries.push({
      key: "ticket-prem",
      tone: "is-ticket",
      label: "고급 뽑기권",
      amount: reward.gachaTicketsPremium!.toLocaleString(),
      icon: rewardImage("/images/yanmar/2d/gacha-ticket-premium.svg", ""),
      tile: rewardImage("/images/yanmar/2d/gacha-ticket-premium.svg", "", "is-lg"),
    });
  }
  return entries;
}

export function QuestRewardChips({ reward }: { reward: QuestReward }) {
  const entries = buildRewardEntries(reward);
  if (entries.length === 0) {
    return <span className="yanmar-quest-chip is-empty">보상 없음</span>;
  }
  return (
    <span className="yanmar-quest-chips">
      {entries.map((entry) => (
        <span
          key={entry.key}
          className={`yanmar-quest-chip ${entry.tone}`}
          title={`${entry.label} ${entry.amount}`}
        >
          {entry.icon}
          <span className="tabular-nums">{entry.amount}</span>
        </span>
      ))}
    </span>
  );
}

export function QuestRewardTiles({ reward }: { reward: QuestReward }) {
  const entries = buildRewardEntries(reward);
  if (entries.length === 0) return null;
  return (
    <div className="yanmar-quest-reward-tiles">
      {entries.map((entry) => (
        <div key={entry.key} className="yanmar-quest-reward-tile">
          {entry.tile}
          <span className="yanmar-quest-reward-tile-amount tabular-nums">
            {entry.amount}
          </span>
          <span className="yanmar-quest-reward-tile-label">{entry.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Facility (workshop / monument) point reward chip matching premium quest chips. */
export function QuestPointsChip({
  iconSrc,
  amount,
  label,
}: {
  iconSrc: string;
  amount: number;
  label: string;
}) {
  const amountLabel = amount.toLocaleString();
  return (
    <span className="yanmar-quest-chips">
      <span
        className="yanmar-quest-chip is-points"
        title={`${label} ${amountLabel}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconSrc}
          alt=""
          className="yanmar-quest-reward-icon"
          draggable={false}
        />
        <span className="tabular-nums">{amountLabel}</span>
      </span>
    </span>
  );
}

export type QuestCardState = "active" | "claimable" | "done";

export function QuestCard({
  title,
  tag,
  reward,
  rewardSlot,
  meta,
  value,
  target,
  metric,
  state,
  action,
}: {
  title: string;
  tag?: { label: string; tone?: "required" | "bonus" };
  reward?: QuestReward;
  /** Custom reward chips (e.g. workshop / monument points). */
  rewardSlot?: ReactNode;
  meta?: ReactNode;
  value: number;
  target: number;
  metric?: QuestMetric;
  state: QuestCardState;
  action?: ReactNode;
}) {
  const reached = state === "done" || state === "claimable";
  const shown = reached ? Math.max(value, target) : value;
  const pct =
    target <= 0 ? 0 : Math.min(100, Math.round((shown / target) * 100));
  const current = formatQuestProgressCurrent(shown, target, metric);

  return (
    <li
      className={`yanmar-quest-card${action ? " has-action" : ""} ${
        state === "claimable"
          ? "is-claimable"
          : state === "done"
            ? "is-done"
            : ""
      }`.trim()}
    >
      <span
        className={`yanmar-quest-medal${
          state === "done"
            ? " is-done"
            : state === "claimable"
              ? " is-claimable"
              : ""
        }`}
        style={{ "--qm-pct": pct } as CSSProperties}
        aria-hidden
      >
        {state === "done" ? (
          <CheckGlyph className="yanmar-quest-medal-check" />
        ) : (
          <span className="yanmar-quest-medal-value tabular-nums">{pct}%</span>
        )}
      </span>

      <div className="yanmar-quest-card-main">
        <div className="yanmar-quest-card-topline">
          <p className="yanmar-quest-card-title">
            {tag ? (
              <span
                className={`yanmar-quest-card-tag${
                  tag.tone === "bonus" ? " is-bonus" : ""
                }`}
              >
                {tag.label}
              </span>
            ) : null}
            {title}
          </p>
          {rewardSlot ? rewardSlot : reward ? <QuestRewardChips reward={reward} /> : null}
        </div>
        {meta ? <div className="yanmar-quest-card-meta">{meta}</div> : null}
        <div
          className="yanmar-quest-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={current}
          aria-label={`${title} 진행도`}
        >
          <span
            className={`yanmar-quest-track-fill${state === "done" ? " is-done" : ""}`}
            style={{ width: `${pct}%` }}
          />
          <span className="yanmar-quest-track-labels">
            <span
              className={`yanmar-quest-track-note${pct >= 26 ? " is-on-fill" : ""}`}
            >
              {reached
                ? "목표 달성"
                : `남은 ${Math.max(0, target - current).toLocaleString()}`}
            </span>
            <span
              className={`yanmar-quest-track-count tabular-nums${
                pct >= 76 ? " is-on-fill" : ""
              }`}
            >
              {current.toLocaleString()} / {target.toLocaleString()}
            </span>
          </span>
        </div>
      </div>

      {action ? <div className="yanmar-quest-card-action">{action}</div> : null}
    </li>
  );
}

export function ClaimButton({
  claiming,
  onClaim,
  label = "보상 받기",
}: {
  claiming: boolean;
  onClaim: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="yanmar-quest-claim"
      disabled={claiming}
      onClick={onClaim}
    >
      {claiming ? "수령 중" : label}
    </button>
  );
}

export function DoneStamp({ label = "완료" }: { label?: string }) {
  return (
    <span className="yanmar-quest-stamp">
      <CheckGlyph />
      {label}
    </span>
  );
}

export function PendingStamp() {
  return <span className="yanmar-quest-stamp is-pending">진행 중</span>;
}
