"use client";

import { useEffect, useState } from "react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";

interface InventoryCoupon {
  id: string;
  type: "YK_PARTS_DISCOUNT" | "EQUIPMENT_RENTAL_DISCOUNT";
  discountPct: number;
  barcodeCode: string;
  expiresAt: string;
  usedAt: string | null;
}

function couponTitle(type: InventoryCoupon["type"]) {
  return type === "YK_PARTS_DISCOUNT"
    ? "YK건기 부품 할인권"
    : "중장비 대여 할인권";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function BarcodePreview({ code }: { code: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div
        className="h-14 rounded bg-black"
        style={{
          background:
            "repeating-linear-gradient(90deg,#111 0 2px,#fff 2px 4px,#111 4px 5px,#fff 5px 8px,#111 8px 11px,#fff 11px 13px)",
        }}
      />
      <p className="mt-2 text-center font-mono text-[11px] font-bold tracking-widest text-gray-800">
        {code}
      </p>
    </div>
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

  const selectedCoupon = coupons.find((coupon) => coupon.id === selectedCouponId) ?? null;

  return (
    <AppModalOverlay open={open} onClose={onClose}>
      <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-amber-500 px-4 py-3 text-white">
          <h2 className="text-base font-black">쿠폰함</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-bold hover:bg-white/30"
          >
            닫기
          </button>
        </div>
        <div className="space-y-3 p-4">
          {loading ? (
            <p className="py-8 text-center text-xs text-gray-400">쿠폰함 불러오는 중...</p>
          ) : coupons.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-400">보유 쿠폰이 없습니다.</p>
          ) : (
            <>
              <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                {coupons.map((coupon) => {
                  const selected = coupon.id === selectedCouponId;
                  return (
                    <button
                      key={coupon.id}
                      type="button"
                      onClick={() => setSelectedCouponId(coupon.id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left ${
                        selected
                          ? "border-amber-300 bg-amber-50"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-gray-800">
                          {couponTitle(coupon.type)}
                        </span>
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                          {coupon.discountPct}%
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-gray-500">
                        만료 {formatDate(coupon.expiresAt)}
                        {coupon.usedAt ? " · 사용됨" : ""}
                      </p>
                    </button>
                  );
                })}
              </div>

              {selectedCoupon ? <BarcodePreview code={selectedCoupon.barcodeCode} /> : null}
            </>
          )}
        </div>
      </div>
    </AppModalOverlay>
  );
}
