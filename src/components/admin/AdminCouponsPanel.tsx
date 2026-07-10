"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "./AdminShell";

interface QuotaRow {
  type: string;
  label: string;
  limit: number;
  issued: number;
  remaining: number;
  mailIssued: number;
}

interface CouponRow {
  id: string;
  type: string;
  typeLabel: string;
  discountPct: number;
  barcodeCode: string;
  fromGameDrop: boolean;
  source: "game" | "mail";
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    loginId: string;
    nickname: string | null;
    email: string;
  };
}

interface SeasonOption {
  key: string;
  label: string;
  isCurrent: boolean;
}

interface CouponsResponse {
  season: {
    key: string;
    label: string;
    endsAt: string;
    isCurrent: boolean;
  };
  seasons: SeasonOption[];
  couponTypes: Array<{ type: string; label: string }>;
  summary: {
    totalRemaining: number;
    totalLimit: number;
    totalIssued: number;
  };
  quotas: QuotaRow[];
  coupons: CouponRow[];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function AdminCouponsPanel() {
  const [seasonKey, setSeasonKey] = useState<string | null>(null);
  const [data, setData] = useState<CouponsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (key: string | null) => {
    setLoading(true);
    setError(false);
    try {
      const qs = key ? `?seasonKey=${encodeURIComponent(key)}` : "";
      const res = await fetch(`/api/admin/coupons${qs}`);
      if (!res.ok) throw new Error("failed");
      const json = (await res.json()) as CouponsResponse;
      setData(json);
      setSeasonKey(json.season.key);
    } catch {
      setData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null);
  }, [load]);

  return (
    <AdminShell
      title="쿠폰 관리"
      subtitle="시즌별 쿠폰 종류·잔여 수량과 획득 내역을 확인합니다."
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                조회 시즌
              </p>
              <h2 className="mt-1 text-lg font-black text-slate-900">
                {data?.season.label ?? "시즌 선택"}
                {data?.season.isCurrent ? (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    현재
                  </span>
                ) : null}
              </h2>
              {data ? (
                <p className="mt-1 text-xs text-slate-500">
                  시즌 키 {data.season.key} · 종료 {formatDateTime(data.season.endsAt)}
                </p>
              ) : null}
            </div>

            <label className="block w-full sm:w-56">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                시즌 선택
              </span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
                value={seasonKey ?? ""}
                disabled={loading || !data?.seasons?.length}
                onChange={(e) => {
                  const next = e.target.value;
                  setSeasonKey(next);
                  void load(next);
                }}
              >
                {(data?.seasons ?? []).map((season) => (
                  <option key={season.key} value={season.key}>
                    {season.label}
                    {season.isCurrent ? " (현재)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {data ? (
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white/80 px-3 py-2 text-center ring-1 ring-emerald-100">
                <p className="text-[10px] font-bold text-slate-400">잔여 합계</p>
                <p className="text-xl font-black text-emerald-600">
                  {data.summary.totalRemaining}
                </p>
              </div>
              <div className="rounded-xl bg-white/80 px-3 py-2 text-center ring-1 ring-slate-100">
                <p className="text-[10px] font-bold text-slate-400">발급</p>
                <p className="text-xl font-black text-slate-800">
                  {data.summary.totalIssued}
                </p>
              </div>
              <div className="rounded-xl bg-white/80 px-3 py-2 text-center ring-1 ring-slate-100">
                <p className="text-[10px] font-bold text-slate-400">시즌 한도</p>
                <p className="text-xl font-black text-slate-800">
                  {data.summary.totalLimit}
                </p>
              </div>
            </div>
          ) : null}

          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            게임 드롭 쿠폰만 시즌 한도에 포함됩니다. 우편 지급은 한도에 영향을 주지
            않습니다. 유저에게는 잔여 수량이 표시되지 않습니다.
          </p>
        </div>

        {loading && !data ? (
          <p className="py-10 text-center text-sm text-slate-400">불러오는 중...</p>
        ) : error && !data ? (
          <p className="py-10 text-center text-sm text-slate-400">
            쿠폰 정보를 불러오지 못했습니다.
          </p>
        ) : data ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-black text-slate-900">쿠폰 종류별 잔여</h3>
                {loading ? (
                  <span className="text-[10px] font-bold text-slate-400">갱신 중...</span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-400">
                    {data.quotas.length}종류
                  </span>
                )}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {data.quotas.map((quota) => {
                  const usedPct =
                    quota.limit > 0
                      ? Math.min(100, Math.round((quota.issued / quota.limit) * 100))
                      : 0;
                  const depleted = quota.remaining <= 0;
                  return (
                    <div
                      key={quota.type}
                      className={`rounded-xl border px-3 py-3 ${
                        depleted
                          ? "border-red-100 bg-red-50/40"
                          : "border-slate-100 bg-slate-50/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-black text-slate-900">
                            {quota.label}
                          </p>
                          <p className="mt-0.5 text-[10px] font-mono text-slate-400">
                            {quota.type}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            depleted
                              ? "bg-red-100 text-red-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {depleted ? "소진" : "잔여 있음"}
                        </span>
                      </div>

                      <div className="mt-3 flex items-end justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            남은 쿠폰
                          </p>
                          <p
                            className={`text-3xl font-black ${
                              depleted ? "text-red-600" : "text-emerald-600"
                            }`}
                          >
                            {quota.remaining}
                          </p>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          <p>
                            발급 {quota.issued} / 한도 {quota.limit}
                          </p>
                          <p className="mt-0.5">우편 지급 {quota.mailIssued}장</p>
                        </div>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                        <div
                          className={`h-full rounded-full transition-all ${
                            depleted ? "bg-red-400" : "bg-emerald-500"
                          }`}
                          style={{ width: `${usedPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-black text-slate-900">
                  {data.season.label} 획득 내역
                </h3>
                <span className="text-[10px] font-bold text-slate-400">
                  최근 {data.coupons.length}건
                </span>
              </div>

              {data.coupons.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  이 시즌에 발급된 쿠폰이 없습니다.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {data.coupons.map((coupon) => (
                    <div
                      key={coupon.id}
                      className="rounded-xl border border-slate-100 px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-800">
                            {coupon.typeLabel}{" "}
                            <span className="text-red-600">{coupon.discountPct}%</span>
                          </p>
                          <Link
                            href={`/admin/users/${coupon.user.id}`}
                            className="mt-0.5 block truncate text-[11px] font-semibold text-blue-600 hover:underline"
                          >
                            {coupon.user.nickname || coupon.user.loginId}
                            <span className="font-normal text-slate-400">
                              {" "}
                              · {coupon.user.loginId}
                            </span>
                          </Link>
                          <p className="mt-1 font-mono text-[10px] tracking-wide text-slate-400">
                            {coupon.barcodeCode}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              coupon.source === "game"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {coupon.source === "game" ? "게임" : "우편"}
                          </span>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {formatDateTime(coupon.createdAt)}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            만료 {formatDate(coupon.expiresAt)}
                            {coupon.usedAt ? " · 사용됨" : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}
