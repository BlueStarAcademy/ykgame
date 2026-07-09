"use client";

import { useEffect, useState } from "react";
import { YANMAR_EQUIPMENT_CONFIG } from "@/games/yanmar/equipment";
import { AdminShell } from "./AdminShell";

interface UserDetail {
  id: string;
  loginId: string;
  email: string;
  nickname: string | null;
  role: string;
  currency: number;
  isActive: boolean;
  createdAt: string;
  _count: {
    gameScores: number;
    coupons: number;
    mails: number;
    rewardInventoryItems: number;
  };
  gameScores: Array<{
    id: string;
    gameId: string;
    score: number;
    stars: number;
    playTime: number;
    createdAt: string;
  }>;
  coupons: Array<{
    id: string;
    type: string;
    discountPct: number;
    expiresAt: string;
    usedAt: string | null;
  }>;
  equipmentUpgrades: Array<{
    part: string;
    level: number;
  }>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AdminUserDetail({ userId }: { userId: string }) {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currencyDelta, setCurrencyDelta] = useState(10);
  const [saving, setSaving] = useState(false);

  async function loadUser() {
    setLoading(true);
    const res = await fetch(`/api/admin/users/${userId}`);
    const data = await res.json();
    setUser(data.user ?? null);
    setLoading(false);
  }

  useEffect(() => {
    loadUser();
  }, [userId]);

  async function patchUser(body: Record<string, unknown>) {
    setSaving(true);
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await loadUser();
    setSaving(false);
  }

  async function adjustCurrency(mode: "add" | "set") {
    await fetch("/api/admin/currency", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, amount: currencyDelta, mode }),
    });
    await loadUser();
  }

  if (loading) {
    return (
      <AdminShell title="회원 상세" backHref="/admin/users">
        <p className="py-10 text-center text-sm text-slate-400">불러오는 중...</p>
      </AdminShell>
    );
  }

  if (!user) {
    return (
      <AdminShell title="회원 상세" backHref="/admin/users">
        <p className="py-10 text-center text-sm text-slate-400">회원을 찾을 수 없습니다.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={user.loginId}
      subtitle={user.nickname ?? "닉네임 없음"}
      backHref="/admin/users"
      backLabel="회원 목록"
    >
      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">기본 정보</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-slate-400">아이디</dt>
              <dd className="mt-0.5 font-bold text-slate-800">{user.loginId}</dd>
            </div>
            <div>
              <dt className="text-slate-400">닉네임</dt>
              <dd className="mt-0.5 font-bold text-slate-800">{user.nickname ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">이메일</dt>
              <dd className="mt-0.5 font-bold text-slate-800">{user.email}</dd>
            </div>
            <div>
              <dt className="text-slate-400">역할</dt>
              <dd className="mt-0.5 font-bold text-slate-800">{user.role}</dd>
            </div>
            <div>
              <dt className="text-slate-400">보유 스타</dt>
              <dd className="mt-0.5 font-bold text-amber-700">⭐ {user.currency.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-slate-400">계정 상태</dt>
              <dd className="mt-0.5 font-bold text-slate-800">
                {user.isActive ? "정상" : "사용 정지"}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-400">가입일</dt>
              <dd className="mt-0.5 font-bold text-slate-800">{formatDate(user.createdAt)}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">활동 요약</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-slate-400">플레이 기록</p>
              <p className="mt-0.5 font-bold text-slate-800">{user._count.gameScores}회</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-slate-400">보유 쿠폰</p>
              <p className="mt-0.5 font-bold text-slate-800">{user._count.coupons}장</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-slate-400">우편</p>
              <p className="mt-0.5 font-bold text-slate-800">{user._count.mails}통</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-slate-400">보상 이력</p>
              <p className="mt-0.5 font-bold text-slate-800">{user._count.rewardInventoryItems}건</p>
            </div>
          </div>
        </section>

        {user.equipmentUpgrades.length > 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black text-slate-900">장비강화</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {user.equipmentUpgrades.map((upgrade) => {
                const partLabel =
                  upgrade.part in YANMAR_EQUIPMENT_CONFIG
                    ? YANMAR_EQUIPMENT_CONFIG[upgrade.part as keyof typeof YANMAR_EQUIPMENT_CONFIG]
                        .label
                    : upgrade.part;
                return (
                <span
                  key={upgrade.part}
                  className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700"
                >
                  {partLabel} +{upgrade.level}
                </span>
                );
              })}
            </div>
          </section>
        ) : null}

        {user.gameScores.length > 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black text-slate-900">최근 플레이</h2>
            <div className="mt-3 space-y-2">
              {user.gameScores.map((score) => (
                <div
                  key={score.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-xs"
                >
                  <span className="font-bold text-slate-800">{score.gameId}</span>
                  <span className="text-slate-500">
                    {score.score.toLocaleString()}점 · ★{score.stars}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {user.coupons.length > 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black text-slate-900">최근 쿠폰</h2>
            <div className="mt-3 space-y-2">
              {user.coupons.map((coupon) => (
                <div
                  key={coupon.id}
                  className="rounded-xl border border-slate-100 px-3 py-2 text-xs"
                >
                  <p className="font-bold text-slate-800">
                    {coupon.type} · {coupon.discountPct}%
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    만료 {formatDate(coupon.expiresAt)}
                    {coupon.usedAt ? " · 사용됨" : ""}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">관리 작업</h2>
          <div className="mt-3 space-y-3">
            {user.role !== "ADMIN" ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => patchUser({ isActive: !user.isActive })}
                className={`w-full rounded-xl py-3 text-sm font-bold text-white ${
                  user.isActive
                    ? "bg-red-600 hover:bg-red-500"
                    : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >
                {user.isActive ? "사용 정지" : "사용 정지 해제"}
              </button>
            ) : (
              <p className="text-xs text-slate-400">관리자 계정은 정지할 수 없습니다.</p>
            )}

            <div className="flex gap-2">
              <input
                type="number"
                value={currencyDelta}
                onChange={(e) => setCurrencyDelta(Number(e.target.value))}
                className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                min={0}
              />
              <button
                type="button"
                onClick={() => adjustCurrency("add")}
                className="flex-1 rounded-xl bg-amber-500 py-2 text-sm font-bold text-white hover:bg-amber-400"
              >
                스타 지급
              </button>
              <button
                type="button"
                onClick={() => adjustCurrency("set")}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                스타 설정
              </button>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
