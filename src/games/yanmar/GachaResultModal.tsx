"use client";

import { useEffect, useRef, useState } from "react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import {
  GEAR_SLOTS,
  ITEM_GRADE_LABEL,
  type GachaBanner,
  type GearSlot,
  type ItemGrade,
} from "./gearCatalog";
import { GearIconCell } from "./GearIconCell";

export type GachaResultItem = {
  nameSnapshot: string;
  grade: string;
  slot?: GearSlot | string;
};

/** Banner top tier: STANDARD → 정밀, PREMIUM → 마스터 */
export const GACHA_JACKPOT_GRADE: Record<GachaBanner, ItemGrade> = {
  STANDARD: "PRECISION",
  PREMIUM: "MASTER",
};

const REVEAL_MS = 520;
const JACKPOT_HOLD_MS = 1350;
const JACKPOT_GAP_MS = 160;
const FIRST_LEAD_MS = 280;

interface GachaResultModalProps {
  open: boolean;
  onClose: () => void;
  results: GachaResultItem[] | null;
  banner?: GachaBanner | null;
}

function isGearSlot(v: unknown): v is GearSlot {
  return typeof v === "string" && (GEAR_SLOTS as readonly string[]).includes(v);
}

function isItemGrade(v: unknown): v is ItemGrade {
  return (
    v === "NORMAL" ||
    v === "ENHANCED" ||
    v === "PRECISION" ||
    v === "MASTER"
  );
}

function normalizeGrade(v: unknown): ItemGrade {
  return isItemGrade(v) ? v : "NORMAL";
}

function normalizeSlot(v: unknown): GearSlot {
  return isGearSlot(v) ? v : "BUCKET";
}

function resultsKey(results: GachaResultItem[] | null | undefined): string {
  if (!results?.length) return "";
  return results
    .map((r) => `${r.grade}:${r.slot ?? ""}:${r.nameSnapshot}`)
    .join("|");
}

export function GachaResultModal({
  open,
  onClose,
  results,
  banner = "STANDARD",
}: GachaResultModalProps) {
  const items = results ?? [];
  const count = items.length;
  const activeBanner: GachaBanner = banner === "PREMIUM" ? "PREMIUM" : "STANDARD";
  const jackpotGrade = GACHA_JACKPOT_GRADE[activeBanner];
  const sessionKey = resultsKey(results);

  const [revealedCount, setRevealedCount] = useState(0);
  const [phase, setPhase] = useState<"playing" | "done">("playing");
  const [jackpotFlash, setJackpotFlash] = useState(false);
  const [flashGrade, setFlashGrade] = useState<ItemGrade | null>(null);
  const [justRevealedIndex, setJustRevealedIndex] = useState<number | null>(
    null,
  );

  const skipRef = useRef(false);
  const wakeRef = useRef<(() => void) | null>(null);
  const resultsRef = useRef(items);
  resultsRef.current = items;

  useEffect(() => {
    if (!open || !sessionKey) return;

    const pullItems = resultsRef.current;
    if (!pullItems.length) return;

    let cancelled = false;
    skipRef.current = false;
    wakeRef.current = null;
    setRevealedCount(0);
    setPhase("playing");
    setJackpotFlash(false);
    setFlashGrade(null);
    setJustRevealedIndex(null);

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = window.setTimeout(() => {
          wakeRef.current = null;
          resolve();
        }, ms);
        wakeRef.current = () => {
          window.clearTimeout(t);
          wakeRef.current = null;
          resolve();
        };
      });

    async function run() {
      await sleep(FIRST_LEAD_MS);
      if (cancelled) return;

      for (let i = 0; i < pullItems.length; i++) {
        if (cancelled) return;

        if (skipRef.current) {
          setJackpotFlash(false);
          setFlashGrade(null);
          setJustRevealedIndex(null);
          setRevealedCount(pullItems.length);
          setPhase("done");
          return;
        }

        const grade = normalizeGrade(pullItems[i]?.grade);
        const isJackpot = grade === jackpotGrade;

        setJustRevealedIndex(i);
        setRevealedCount(i + 1);

        if (isJackpot) {
          setFlashGrade(grade);
          setJackpotFlash(true);
          await sleep(JACKPOT_HOLD_MS);
          if (cancelled) return;
          setJackpotFlash(false);
          await sleep(JACKPOT_GAP_MS);
        } else {
          await sleep(REVEAL_MS);
        }

        if (cancelled) return;
        setJustRevealedIndex(null);
      }

      if (!cancelled) {
        setJackpotFlash(false);
        setFlashGrade(null);
        setPhase("done");
      }
    }

    void run();

    return () => {
      cancelled = true;
      wakeRef.current?.();
    };
  }, [open, sessionKey, jackpotGrade]);

  const handleSkip = () => {
    if (phase !== "playing" || count <= 1) return;
    skipRef.current = true;
    wakeRef.current?.();
    setJackpotFlash(false);
    setFlashGrade(null);
    setJustRevealedIndex(null);
    setRevealedCount(count);
    setPhase("done");
  };

  const canClose = phase === "done";
  const isMulti = count > 1;
  const showSkip = isMulti && phase === "playing";

  return (
    <AppModalOverlay
      open={open && count > 0}
      onClose={canClose ? onClose : undefined}
      nested
      panelClassName="max-w-[min(96vw,24rem)] landscape:max-h-[min(94dvh,30rem)]"
    >
      <div
        className={`yanmar-gacha-result-modal${
          jackpotFlash ? " is-jackpot-flash" : ""
        }${phase === "playing" ? " is-playing" : ""}`}
      >
        <div className="yanmar-gacha-result-modal-header">
          <h2>획득 결과</h2>
          <span className="yanmar-gacha-result-modal-count">
            {Math.min(revealedCount, count)}/{count}
          </span>
          <div className="yanmar-gacha-result-modal-header-actions">
            {showSkip ? (
              <button
                type="button"
                className="yanmar-gacha-result-skip"
                onClick={handleSkip}
              >
                스킵
              </button>
            ) : null}
            {canClose ? (
              <button
                type="button"
                className="yanmar-gacha-result-close"
                onClick={onClose}
                aria-label="닫기"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>

        <div
          className={`yanmar-gacha-result-modal-grid${
            count <= 1 ? " yanmar-gacha-result-modal-grid--single" : ""
          }`}
        >
          {items.map((r, i) => {
            const slot = normalizeSlot(r.slot);
            const grade = normalizeGrade(r.grade);
            const revealed = i < revealedCount;
            const isJackpot = grade === jackpotGrade;
            const popping = justRevealedIndex === i;

            if (!revealed) {
              return (
                <div
                  key={`sealed-${sessionKey}-${i}`}
                  className="yanmar-gacha-result-modal-card is-sealed"
                  aria-hidden
                >
                  <div className="yanmar-gacha-result-seal">
                    <span>?</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={`open-${sessionKey}-${i}`}
                className={`yanmar-gacha-result-modal-card is-revealed${
                  popping ? " is-pop" : ""
                }${isJackpot ? " is-jackpot" : ""}`}
                title={r.nameSnapshot}
              >
                <GearIconCell
                  slot={slot}
                  grade={grade}
                  size={count <= 1 ? "lg" : "md"}
                />
                <span className="yanmar-gacha-result-modal-grade">
                  {ITEM_GRADE_LABEL[grade]}
                </span>
                <span className="yanmar-gacha-result-modal-name">
                  {r.nameSnapshot}
                </span>
              </div>
            );
          })}
        </div>

        {canClose ? (
          <button
            type="button"
            className="yanmar-gacha-result-modal-confirm"
            onClick={onClose}
          >
            확인
          </button>
        ) : (
          <p className="yanmar-gacha-result-modal-hint">
            {isMulti ? "장비를 여는 중…" : "장비를 확인하는 중…"}
          </p>
        )}

        {jackpotFlash && flashGrade ? (
          <div
            className={`yanmar-gacha-jackpot-overlay yanmar-gacha-jackpot-overlay--${flashGrade.toLowerCase()}`}
            aria-live="assertive"
          >
            <div className="yanmar-gacha-jackpot-burst" aria-hidden />
            <div className="yanmar-gacha-jackpot-rays" aria-hidden />
            <p className="yanmar-gacha-jackpot-label">
              {ITEM_GRADE_LABEL[flashGrade]}
            </p>
            <p className="yanmar-gacha-jackpot-sub">HIGH GRADE</p>
          </div>
        ) : null}
      </div>
    </AppModalOverlay>
  );
}
