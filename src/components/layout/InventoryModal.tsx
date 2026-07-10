"use client";

import { useEffect, useMemo, useState } from "react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";

interface InventoryCoupon {
  id: string;
  type: "YK_PARTS_DISCOUNT" | "EQUIPMENT_RENTAL_DISCOUNT" | "FILTER_SET_EXCHANGE";
  discountPct: number;
  barcodeCode: string;
  expiresAt: string;
  usedAt: string | null;
}

function couponTitle(type: InventoryCoupon["type"]) {
  switch (type) {
    case "YK_PARTS_DISCOUNT":
      return "YK건기 부품 할인권";
    case "EQUIPMENT_RENTAL_DISCOUNT":
      return "중장비 대여 할인권";
    case "FILTER_SET_EXCHANGE":
      return "필터세트 교환쿠폰";
  }
}

function couponBadge(coupon: InventoryCoupon) {
  if (coupon.type === "FILTER_SET_EXCHANGE") return "교환";
  return `${coupon.discountPct}%`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function isCouponExpired(expiresAt: string, now = Date.now()) {
  return new Date(expiresAt).getTime() <= now;
}

function daysUntilExpiry(expiresAt: string, now = Date.now()) {
  const ms = new Date(expiresAt).getTime() - now;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/** Deterministic bar widths from coupon code for a Code39-like preview. */
function barcodeBars(code: string) {
  const bars: number[] = [];
  for (let i = 0; i < code.length; i++) {
    const n = code.charCodeAt(i);
    bars.push(1 + (n % 3));
    bars.push(1 + ((n >> 2) % 2));
    bars.push(1 + ((n >> 4) % 3));
  }
  return bars;
}

function BarcodePreview({ code }: { code: string }) {
  const bars = useMemo(() => barcodeBars(code), [code]);

  return (
    <div className="h-full rounded-xl border border-gray-200 bg-white px-3 py-2.5">
      <div className="flex h-[4.25rem] items-stretch justify-center gap-px overflow-hidden rounded bg-white px-1">
        {bars.map((width, index) => (
          <span
            key={`${code}-${index}`}
            className={index % 2 === 0 ? "bg-gray-900" : "bg-white"}
            style={{ flex: `${width} ${width} 0`, minWidth: 0 }}
            aria-hidden
          />
        ))}
      </div>
      <p className="mt-1.5 text-center font-mono text-[11px] font-bold tracking-widest text-gray-800">
        {code}
      </p>
    </div>
  );
}

function ExpiryBadge({
  expiresAt,
  usedAt,
}: {
  expiresAt: string;
  usedAt: string | null;
}) {
  const expired = isCouponExpired(expiresAt);
  const daysLeft = daysUntilExpiry(expiresAt);

  if (usedAt) {
    return (
      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
        사용됨
      </span>
    );
  }

  if (expired) {
    return (
      <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
        기간 만료
      </span>
    );
  }

  if (daysLeft <= 14) {
    return (
      <span className="rounded-md bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
        D-{daysLeft}
      </span>
    );
  }

  return (
    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
      {daysLeft}일 남음
    </span>
  );
}

interface InventoryModalProps {
  open: boolean;
  onClose: () => void;
}

export function InventoryModal({ open, onClose }: InventoryModalProps) {
  const [coupons, setCoupons] = useState<InventoryCoupon[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch("/api/inventory")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setCoupons(data.coupons ?? []);
        setSelectedCouponId(data.coupons?.[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setCoupons([]);
          setSelectedCouponId(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const selectedCoupon =
    coupons.find((coupon) => coupon.id === selectedCouponId) ?? null;
  const selectedExpired = selectedCoupon
    ? isCouponExpired(selectedCoupon.expiresAt)
    : false;
  const selectedUsed = Boolean(selectedCoupon?.usedAt);
  const canShowBarcode = Boolean(selectedCoupon) && !selectedExpired && !selectedUsed;

  return (
    <AppModalOverlay open={open} onClose={onClose}>
      <div className="flex h-[min(82dvh,36rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl landscape:h-[min(90dvh,22rem)]">
        <div className="flex shrink-0 items-center justify-between bg-amber-500 px-4 py-3 text-white">
          <h2 className="text-base font-black">쿠폰함</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-bold hover:bg-white/30"
          >
            닫기
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          <div className="h-[7.25rem] shrink-0">
            {loading ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50">
                <p className="text-xs text-gray-400">불러오는 중...</p>
              </div>
            ) : !selectedCoupon ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50">
                <p className="text-xs text-gray-400">쿠폰을 선택하세요</p>
              </div>
            ) : canShowBarcode ? (
              <BarcodePreview code={selectedCoupon.barcodeCode} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-red-100 bg-red-50 px-3 text-center">
                <p className="text-xs font-black text-red-700">
                  {selectedUsed ? "이미 사용된 쿠폰입니다" : "유효기간이 만료되었습니다"}
                </p>
                <p className="mt-1 text-[10px] text-red-500">
                  바코드를 표시할 수 없습니다
                </p>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {loading ? null : coupons.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">
                보유 쿠폰이 없습니다.
              </p>
            ) : (
              <div className="h-full space-y-2 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
                {coupons.map((coupon) => {
                  const selected = coupon.id === selectedCouponId;
                  const expired = isCouponExpired(coupon.expiresAt);
                  return (
                    <button
                      key={coupon.id}
                      type="button"
                      onClick={() => setSelectedCouponId(coupon.id)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                        selected
                          ? "border-amber-300 bg-amber-50"
                          : expired
                            ? "border-gray-200 bg-gray-50 opacity-75 hover:bg-gray-100"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-black ${
                            expired ? "text-gray-500" : "text-gray-800"
                          }`}
                        >
                          {couponTitle(coupon.type)}
                        </span>
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                          {couponBadge(coupon)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <p
                          className={`text-[11px] font-semibold ${
                            expired ? "text-red-600" : "text-gray-700"
                          }`}
                        >
                          유효기간 {formatDate(coupon.expiresAt)}
                        </p>
                        <ExpiryBadge
                          expiresAt={coupon.expiresAt}
                          usedAt={coupon.usedAt}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppModalOverlay>
  );
}
