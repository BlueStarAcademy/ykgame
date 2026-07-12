"use client";

import { useEffect, useState } from "react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";

const STORAGE_KEY = "ykgame:landing:promo-dismissed-date";

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function wasDismissedToday() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === todayKey();
  } catch {
    return false;
  }
}

function dismissForToday() {
  try {
    window.localStorage.setItem(STORAGE_KEY, todayKey());
  } catch {
    /* ignore quota / private mode */
  }
}

export function LandingPromoPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!wasDismissedToday()) {
      setOpen(true);
    }
  }, []);

  function handleClose() {
    setOpen(false);
  }

  function handleHideToday() {
    dismissForToday();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <AppModalOverlay
      open={open}
      onClose={handleClose}
      panelClassName="!flex !max-h-[min(92dvh,36rem)] !flex-col !overflow-hidden max-w-[22rem] landscape:!max-h-[min(94dvh,22rem)]"
    >
      <div className="landing-promo flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="landing-promo-body min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          <div className="landing-promo-frame">
            <div className="landing-promo-visual relative overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/landing/promo-mileage.png"
                alt="얀마 굴착기 마일리지 이벤트"
                className="landing-promo-img block h-full w-full object-cover object-center"
                width={800}
                height={450}
              />
              <div className="landing-promo-overlay" aria-hidden />
              <div className="landing-promo-caption absolute inset-x-0 bottom-0 z-[1] px-4 pb-4 pt-10 text-center text-white">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
                  YK Event · 2026 3시즌
                </p>
                <p className="mt-1.5 text-[12px] font-medium tracking-wide text-white/90">
                  마일리지
                </p>
                <p className="landing-promo-sum mt-0.5 text-[2.35rem] font-black leading-none tracking-tight">
                  <span className="landing-promo-num">5만</span>
                  <span className="landing-promo-plus mx-1 text-[1.75rem] text-amber-200">+</span>
                  <span className="landing-promo-num">5만</span>
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 px-4 pb-3 pt-1">
            <div className="landing-promo-row">
              <span className="landing-promo-badge" aria-hidden>
                01
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold leading-snug text-gray-900">
                  얀마 게임 100만점 돌파
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">
                  YK건기 마일리지{" "}
                  <span className="font-bold text-red-600">5만 포인트</span> 선착순 5명 지급
                </p>
              </div>
            </div>

            <div className="landing-promo-row">
              <span className="landing-promo-badge" aria-hidden>
                02
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold leading-snug text-gray-900">
                  2026-3시즌 랭킹 1위
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">
                  2026년 7월~9월 ·{" "}
                  <span className="font-bold text-red-600">5만 포인트</span> 추가 지급
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="landing-promo-footer flex shrink-0 gap-2 border-t border-gray-100 bg-white px-4 py-3">
          <button
            type="button"
            onClick={handleHideToday}
            className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[12px] font-semibold text-gray-600 transition hover:bg-gray-100"
          >
            오늘 다시 보지않기
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="landing-promo-close flex-1 rounded-xl px-3 py-2.5 text-[12px] font-bold text-white transition"
          >
            닫기
          </button>
        </div>
      </div>
    </AppModalOverlay>
  );
}
