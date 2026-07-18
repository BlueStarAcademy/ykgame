"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./LandingPromoPopup.module.css";
import { useRegisterInGameBackDismiss } from "@/hooks/useInGameBackNavigation";

export type PromoPopupSurface = "landing" | "ingame";

const STORAGE_KEYS: Record<PromoPopupSurface, string> = {
  landing: "ykgame:landing:promo-dismissed-date",
  ingame: "ykgame:yanmar:promo-dismissed-date",
};

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function wasDismissedToday(surface: PromoPopupSurface) {
  try {
    return window.localStorage.getItem(STORAGE_KEYS[surface]) === todayKey();
  } catch {
    return false;
  }
}

function dismissForToday(surface: PromoPopupSurface) {
  try {
    window.localStorage.setItem(STORAGE_KEYS[surface], todayKey());
  } catch {
    /* ignore quota / private mode */
  }
}

interface LandingPromoPopupProps {
  /** 랜딩·인게임은 각각 따로 '오늘 다시 보지않기'를 기억합니다. */
  surface?: PromoPopupSurface;
}

export function LandingPromoPopup({ surface = "landing" }: LandingPromoPopupProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useRegisterInGameBackDismiss(open, () => setOpen(false));

  useEffect(() => {
    setMounted(true);
    if (!wasDismissedToday(surface)) {
      setOpen(true);
    }
  }, [surface]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleClose() {
    setOpen(false);
  }

  function handleHideToday() {
    dismissForToday(surface);
    setOpen(false);
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div className={styles.backdrop} onClick={handleClose}>
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="YK건기 마일리지 이벤트"
      >
        <div className={styles.body}>
          <div className={styles.frame}>
            <div className={styles.visual}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/landing/promo-mileage.png"
                alt="얀마 굴착기 마일리지 이벤트"
                className={styles.img}
                width={800}
                height={500}
              />
              <div className={styles.overlay} aria-hidden />
              <div className={styles.caption}>
                <p className={styles.eyebrow}>YK Event · 2026 3시즌</p>
                <p className={styles.label}>마일리지</p>
                <p className={styles.sum}>
                  <span className={styles.num}>5만</span>
                  <span className={styles.plus}>+</span>
                  <span className={styles.num}>5만</span>
                </p>
              </div>
            </div>
          </div>

          <div className={styles.rows}>
            <div className={styles.row}>
              <span className={styles.badge} aria-hidden>
                01
              </span>
              <div className="min-w-0 flex-1">
                <p className={styles.rowTitle}>얀마 게임 100만점 돌파</p>
                <p className={styles.rowDesc}>
                  YK건기 마일리지 <span>5만 포인트</span> 선착순 5명 지급
                </p>
              </div>
            </div>

            <div className={styles.row}>
              <span className={styles.badge} aria-hidden>
                02
              </span>
              <div className="min-w-0 flex-1">
                <p className={styles.rowTitle}>2026-3시즌 랭킹 1위</p>
                <p className={styles.rowDesc}>
                  2026년 7월~9월 · <span>5만 포인트</span> 추가 지급
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" onClick={handleHideToday} className={styles.btnMute}>
            오늘 다시 보지않기
          </button>
          <button type="button" onClick={handleClose} className={styles.btnClose}>
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
