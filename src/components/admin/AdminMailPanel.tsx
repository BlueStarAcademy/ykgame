"use client";

import { useState } from "react";
import { AdminShell } from "./AdminShell";

type MailTarget = "all" | "active";
type CouponType = "YK_PARTS_DISCOUNT" | "EQUIPMENT_RENTAL_DISCOUNT" | "";

export function AdminMailPanel() {
  const [target, setTarget] = useState<MailTarget>("active");
  const [title, setTitle] = useState("운영자 우편");
  const [body, setBody] = useState("");
  const [currencyAmount, setCurrencyAmount] = useState(10);
  const [includeCurrency, setIncludeCurrency] = useState(true);
  const [includeCoupon, setIncludeCoupon] = useState(false);
  const [couponType, setCouponType] = useState<CouponType>("YK_PARTS_DISCOUNT");
  const [couponDiscountPct, setCouponDiscountPct] = useState(10);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function sendMail() {
    if (!title.trim()) {
      alert("제목을 입력해주세요.");
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          title: title.trim(),
          body: body.trim() || undefined,
          currencyAmount: includeCurrency ? currencyAmount : 0,
          couponType: includeCoupon ? couponType : undefined,
          couponDiscountPct: includeCoupon ? couponDiscountPct : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "발송 실패");
      }
      setResult(`${data.sentCount}명에게 우편을 발송했습니다.`);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "발송 실패");
    } finally {
      setSending(false);
    }
  }

  return (
    <AdminShell title="우편발송" subtitle="재화 지급 및 우편을 일괄 발송합니다.">
      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">발송 대상</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTarget("active")}
              className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${
                target === "active"
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              활성 회원 전체
            </button>
            <button
              type="button"
              onClick={() => setTarget("all")}
              className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${
                target === "all"
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              전체 회원
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">우편 내용</h2>
          <div className="mt-3 space-y-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="내용 (선택)"
              rows={4}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">첨부 보상</h2>
          <div className="mt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={includeCurrency}
                onChange={(e) => setIncludeCurrency(e.target.checked)}
              />
              스타 지급
            </label>
            {includeCurrency ? (
              <input
                type="number"
                value={currencyAmount}
                onChange={(e) => setCurrencyAmount(Number(e.target.value))}
                min={1}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            ) : null}

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={includeCoupon}
                onChange={(e) => setIncludeCoupon(e.target.checked)}
              />
              쿠폰 첨부
            </label>
            {includeCoupon ? (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={couponType}
                  onChange={(e) => setCouponType(e.target.value as CouponType)}
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="YK_PARTS_DISCOUNT">YK 부품 할인</option>
                  <option value="EQUIPMENT_RENTAL_DISCOUNT">장비 대여 할인</option>
                </select>
                <input
                  type="number"
                  value={couponDiscountPct}
                  onChange={(e) => setCouponDiscountPct(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>
            ) : null}
          </div>
        </section>

        <button
          type="button"
          onClick={sendMail}
          disabled={sending}
          className="w-full rounded-2xl bg-amber-500 py-3.5 text-sm font-black text-white hover:bg-amber-400 disabled:opacity-60"
        >
          {sending ? "발송 중..." : "우편 발송"}
        </button>

        {result ? (
          <p className="rounded-xl bg-slate-900 px-4 py-3 text-center text-xs font-bold text-white">
            {result}
          </p>
        ) : null}
      </div>
    </AdminShell>
  );
}
