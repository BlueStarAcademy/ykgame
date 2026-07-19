"use client";

import type { ReactNode } from "react";
import {
  GEAR_SLOT_LABEL,
  type GearSlot,
  type ItemGrade,
} from "./gearCatalog";
import { gearIconSrc, gradeFrameClass } from "./gearArt";

interface GearIconCellProps {
  slot?: GearSlot | null;
  grade?: ItemGrade | null;
  enhanceLevel?: number;
  empty?: boolean;
  selected?: boolean;
  equipped?: boolean;
  /** 합성 슬롯 등에 선택된 상태 — 체크 표시 */
  checked?: boolean;
  purchase?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  onClick?: () => void;
  title?: string;
  purchaseLabel?: string;
}

const SIZE_CLASS = {
  sm: "yanmar-gear-icon-cell--sm",
  md: "yanmar-gear-icon-cell--md",
  lg: "yanmar-gear-icon-cell--lg",
  xl: "yanmar-gear-icon-cell--xl",
} as const;

export function GearIconCell({
  slot = null,
  grade = null,
  enhanceLevel = 0,
  empty = false,
  selected = false,
  equipped = false,
  checked = false,
  purchase = false,
  size = "md",
  className = "",
  onClick,
  title,
  purchaseLabel,
}: GearIconCellProps) {
  const frame = purchase
    ? "yanmar-gear-frame yanmar-gear-frame--purchase"
    : empty || !grade
      ? gradeFrameClass(null)
      : gradeFrameClass(grade);
  const label =
    title ??
    (purchase
      ? purchaseLabel ?? "슬롯 확장"
      : slot
        ? GEAR_SLOT_LABEL[slot]
        : "빈 슬롯");
  const classNames = `yanmar-gear-icon-cell ${SIZE_CLASS[size]} ${frame}${
    selected ? " is-selected" : ""
  }${equipped ? " is-equipped" : ""}${checked ? " is-checked" : ""}${
    purchase ? " is-purchase" : ""
  }${empty && !purchase ? " is-empty" : ""}${className ? ` ${className}` : ""}`;

  let content: ReactNode = null;
  if (purchase) {
    content = (
      <>
        <span className="yanmar-gear-icon-cell-plus" aria-hidden>
          +
        </span>
        <span className="yanmar-gear-icon-cell-purchase-label">슬롯</span>
      </>
    );
  } else if (empty && slot) {
    // 장착 빈슬롯: 부위 아이콘을 비활성 실루엣으로
    content = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={gearIconSrc(slot, "NORMAL")}
        alt=""
        className="yanmar-gear-icon-cell-img yanmar-gear-icon-cell-img--empty"
        draggable={false}
        decoding="async"
        loading="eager"
      />
    );
  } else if (empty || !slot) {
    // 인벤토리 빈슬롯: 프레임만 (이미지 없음)
    content = null;
  } else {
    content = (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={gearIconSrc(slot, grade)}
          alt=""
          className="yanmar-gear-icon-cell-img"
          draggable={false}
          decoding="async"
          loading="eager"
        />
        {enhanceLevel > 0 ? (
          <span className="yanmar-gear-icon-cell-badge">+{enhanceLevel}</span>
        ) : null}
        {equipped ? (
          <span className="yanmar-gear-icon-cell-e" aria-hidden>
            E
          </span>
        ) : null}
        {checked ? (
          <span className="yanmar-gear-icon-cell-check" aria-hidden>
            ✓
          </span>
        ) : null}
      </>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        className={classNames}
        onClick={onClick}
        title={label}
        aria-label={label}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={classNames} title={label} aria-label={label}>
      {content}
    </div>
  );
}
