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
import { gearIconSrc, preloadGearIconSrcs } from "./gearArt";
import { GearIconCell } from "./GearIconCell";
import { yanmarAudio } from "./yanmarAudio";

export type GachaResultItem = {
  nameSnapshot: string;
  grade: string;
  slot?: GearSlot | string;
  /** 합성 등급 상승 등 — 연속 공개 시 잭팟 연출 */
  upgraded?: boolean;
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
  /** 기본: 획득 결과 / 합성: 합성 결과 */
  title?: string;
  /** 카드마다 획득 효과음 (기본: 연속 공개 시 항상, 단건도 강제하려면 true) */
  perRevealSfx?: boolean;
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
  title = "획득 결과",
  perRevealSfx = false,
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
      // 공개 연출 전에 결과 아이콘을 먼저 받아 빈 프레임/늦게 뜨는 현상을 줄인다.
      const pendingUrls = pullItems.map((item) =>
        gearIconSrc(normalizeSlot(item.slot), normalizeGrade(item.grade)),
      );
      await Promise.race([
        preloadGearIconSrcs(pendingUrls),
        sleep(900),
      ]);
      if (cancelled) return;
      await sleep(FIRST_LEAD_MS);
      if (cancelled) return;

      for (let i = 0; i < pullItems.length; i++) {
        if (cancelled) return;

        if (skipRef.current) {
          const remaining = pullItems.slice(i);
          const hasUnrevealedMaster = remaining.some(
            (item) => normalizeGrade(item.grade) === "MASTER",
          );
          if (remaining.length > 0) {
            if (hasUnrevealedMaster) {
              yanmarAudio.playMasterItemAcquire();
            } else {
              yanmarAudio.playItemAcquire();
            }
          }
          setJackpotFlash(false);
          setFlashGrade(null);
          setJustRevealedIndex(null);
          setRevealedCount(pullItems.length);
          setPhase("done");
          return;
        }

        const grade = normalizeGrade(pullItems[i]?.grade);
        const isJackpot =
          grade === jackpotGrade || Boolean(pullItems[i]?.upgraded);

        setJustRevealedIndex(i);
        setRevealedCount(i + 1);

        if (pullItems.length > 1 || perRevealSfx) {
          if (grade === "MASTER") {
            yanmarAudio.playMasterItemAcquire();
          } else {
            yanmarAudio.playItemAcquire();
          }
        }

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
  }, [open, sessionKey, jackpotGrade, perRevealSfx]);

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
          <h2>{title}</h2>
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
            const isJackpot = grade === jackpotGrade || Boolean(r.upgraded);
            const popping = justRevealedIndex === i;

            return (
              <div
                key={`card-${sessionKey}-${i}`}
                className={`yanmar-gacha-result-modal-card${
                  revealed ? " is-revealed" : " is-sealed"
                }${popping ? " is-pop" : ""}${
                  revealed && isJackpot ? " is-jackpot" : ""
                }`}
                title={revealed ? r.nameSnapshot : undefined}
                aria-hidden={!revealed}
              >
                {/* 봉인 상태에서도 마운트해 브라우저 캐시에 올려 둔다 */}
                <div
                  className={
                    revealed ? undefined : "yanmar-gacha-result-preload-icon"
                  }
                >
                  <GearIconCell
                    slot={slot}
                    grade={grade}
                    size={count <= 1 ? "lg" : "md"}
                  />
                </div>
                {revealed ? (
                  <>
                    <span className="yanmar-gacha-result-modal-grade">
                      {ITEM_GRADE_LABEL[grade]}
                    </span>
                    <span className="yanmar-gacha-result-modal-name">
                      {r.nameSnapshot}
                    </span>
                  </>
                ) : (
                  <div className="yanmar-gacha-result-seal">
                    <span>?</span>
                  </div>
                )}
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
