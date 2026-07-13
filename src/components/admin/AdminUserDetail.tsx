"use client";

import { useEffect, useState } from "react";
import { YANMAR_EQUIPMENT_CONFIG } from "@/games/yanmar/equipment";
import {
  SANCTION_REASON_CUSTOM,
  SANCTION_REASON_PRESETS,
} from "@/lib/sanctions";
import { AdminShell } from "./AdminShell";

interface UserDetail {
  id: string;
  loginId: string;
  email: string;
  nickname: string | null;
  role: string;
  currency: number;
  isActive: boolean;
  sanctionReason: string | null;
  sanctionedAt: string | null;
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

type CouponType =
  | "YK_PARTS_DISCOUNT"
  | "EQUIPMENT_RENTAL_DISCOUNT"
  | "FILTER_SET_EXCHANGE"
  | "";

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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [currencyDelta, setCurrencyDelta] = useState(10);
  const [mailTitle, setMailTitle] = useState("운영자 우편");
  const [mailBody, setMailBody] = useState("");
  const [includeCurrency, setIncludeCurrency] = useState(true);
  const [mailStars, setMailStars] = useState(10);
  const [includeCoupon, setIncludeCoupon] = useState(false);
  const [couponType, setCouponType] = useState<CouponType>("YK_PARTS_DISCOUNT");
  const [couponDiscountPct, setCouponDiscountPct] = useState(10);
  const [sendingMail, setSendingMail] = useState(false);

  const [sanctionPreset, setSanctionPreset] = useState<string>(
    SANCTION_REASON_PRESETS[0],
  );
  const [customReason, setCustomReason] = useState("");

  async function loadUser() {
    setLoading(true);
    const res = await fetch(`/api/admin/users/${userId}`);
    const data = await res.json();
    setUser(data.user ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void loadUser();
  }, [userId]);

  async function adjustCurrency(mode: "add" | "set") {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/currency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount: currencyDelta, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "스타 처리 실패");
      setMessage(mode === "add" ? "스타를 지급했습니다." : "스타를 설정했습니다.");
      await loadUser();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "스타 처리 실패");
    } finally {
      setSaving(false);
    }
  }

  async function sendUserMail() {
    if (!mailTitle.trim()) {
      setMessage("우편 제목을 입력해주세요.");
      return;
    }
    setSendingMail(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          title: mailTitle.trim(),
          body: mailBody.trim() || undefined,
          currencyAmount: includeCurrency ? mailStars : 0,
          couponType: includeCoupon ? couponType : undefined,
          couponDiscountPct: includeCoupon ? couponDiscountPct : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "우편 발송 실패");
      setMessage(`우편을 발송했습니다. (${data.sentCount}통)`);
      await loadUser();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "우편 발송 실패");
    } finally {
      setSendingMail(false);
    }
  }

  async function applySanction() {
    const reason =
      sanctionPreset === SANCTION_REASON_CUSTOM
        ? customReason.trim()
        : sanctionPreset.trim();
    if (!reason) {
      setMessage("제재 사유를 선택하거나 입력해주세요.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false, sanctionReason: reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "제재 처리 실패");
      setMessage("회원 제재를 적용했습니다.");
      await loadUser();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "제재 처리 실패");
    } finally {
      setSaving(false);
    }
  }

  async function liftSanction() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "제재 해제 실패");
      setMessage("제재를 해제했습니다.");
      await loadUser();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "제재 해제 실패");
    } finally {
      setSaving(false);
    }
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
        {message ? (
          <p className="rounded-xl bg-slate-900 px-4 py-3 text-center text-xs font-bold text-white">
            {message}
          </p>
        ) : null}

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
              <dd className="mt-0.5 font-bold text-amber-700">
                ⭐ {user.currency.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">계정 상태</dt>
              <dd
                className={`mt-0.5 font-bold ${
                  user.isActive ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {user.isActive ? "정상" : "제재 중"}
              </dd>
            </div>
            {!user.isActive && user.sanctionReason ? (
              <div className="col-span-2">
                <dt className="text-slate-400">제재 사유</dt>
                <dd className="mt-0.5 font-bold text-red-700">{user.sanctionReason}</dd>
                {user.sanctionedAt ? (
                  <p className="mt-1 text-[10px] text-slate-400">
                    적용일 {formatDate(user.sanctionedAt)}
                  </p>
                ) : null}
              </div>
            ) : null}
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
              <p className="mt-0.5 font-bold text-slate-800">
                {user._count.rewardInventoryItems}건
              </p>
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
                    ? YANMAR_EQUIPMENT_CONFIG[
                        upgrade.part as keyof typeof YANMAR_EQUIPMENT_CONFIG
                      ].label
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

        <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">우편 보내기 · 스타 지급</h2>
          <p className="mt-1 text-[11px] text-slate-500">
            우편 첨부 스타는 회원이 우편함에서 수령합니다. 즉시 지급/설정은 보유 스타에 바로
            반영됩니다.
          </p>

          <div className="mt-3 space-y-3">
            <input
              type="text"
              value={mailTitle}
              onChange={(e) => setMailTitle(e.target.value)}
              placeholder="우편 제목"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
            />
            <textarea
              value={mailBody}
              onChange={(e) => setMailBody(e.target.value)}
              placeholder="우편 내용 (선택)"
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
            />

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={includeCurrency}
                onChange={(e) => setIncludeCurrency(e.target.checked)}
              />
              우편에 스타 첨부
            </label>
            {includeCurrency ? (
              <input
                type="number"
                value={mailStars}
                onChange={(e) => setMailStars(Number(e.target.value))}
                min={1}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
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
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="YK_PARTS_DISCOUNT">YK 부품 할인</option>
                  <option value="EQUIPMENT_RENTAL_DISCOUNT">장비 대여 할인</option>
                  <option value="FILTER_SET_EXCHANGE">필터세트 교환</option>
                </select>
                {couponType === "FILTER_SET_EXCHANGE" ? (
                  <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-500">
                    교환권
                  </div>
                ) : (
                  <input
                    type="number"
                    value={couponDiscountPct}
                    onChange={(e) => setCouponDiscountPct(Number(e.target.value))}
                    min={1}
                    max={100}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                  />
                )}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void sendUserMail()}
              disabled={sendingMail}
              className="w-full rounded-xl bg-amber-500 py-3 text-sm font-black text-white hover:bg-amber-400 disabled:opacity-60"
            >
              {sendingMail ? "발송 중..." : "이 회원에게 우편 발송"}
            </button>

            <div className="border-t border-amber-100 pt-3">
              <p className="text-[11px] font-bold text-slate-600">즉시 스타 지급 / 설정</p>
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  value={currencyDelta}
                  onChange={(e) => setCurrencyDelta(Number(e.target.value))}
                  className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  min={0}
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void adjustCurrency("add")}
                  className="flex-1 rounded-xl bg-amber-600 py-2 text-sm font-bold text-white hover:bg-amber-500 disabled:opacity-60"
                >
                  즉시 지급
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void adjustCurrency("set")}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  보유량 설정
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">제재 관리</h2>
          {user.role === "ADMIN" ? (
            <p className="mt-2 text-xs text-slate-400">관리자 계정은 제재할 수 없습니다.</p>
          ) : user.isActive ? (
            <div className="mt-3 space-y-3">
              <p className="text-[11px] text-slate-500">
                제재 시 홈·게임 입장이 차단되며, 회원에게 사유가 표시됩니다.
              </p>
              <div className="space-y-2">
                {SANCTION_REASON_PRESETS.map((preset) => (
                  <label
                    key={preset}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold ${
                      sanctionPreset === preset
                        ? "border-red-300 bg-red-50 text-red-800"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sanction-reason"
                      checked={sanctionPreset === preset}
                      onChange={() => setSanctionPreset(preset)}
                    />
                    {preset}
                  </label>
                ))}
                <label
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold ${
                    sanctionPreset === SANCTION_REASON_CUSTOM
                      ? "border-red-300 bg-red-50 text-red-800"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="sanction-reason"
                    className="mt-0.5"
                    checked={sanctionPreset === SANCTION_REASON_CUSTOM}
                    onChange={() => setSanctionPreset(SANCTION_REASON_CUSTOM)}
                  />
                  <span className="flex-1">
                    직접 입력
                    {sanctionPreset === SANCTION_REASON_CUSTOM ? (
                      <textarea
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        rows={2}
                        placeholder="제재 사유를 입력하세요"
                        className="mt-2 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-slate-800"
                      />
                    ) : null}
                  </span>
                </label>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void applySanction()}
                className="w-full rounded-xl bg-red-600 py-3 text-sm font-black text-white hover:bg-red-500 disabled:opacity-60"
              >
                제재 적용 (게임 입장 차단)
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-red-200 bg-white px-3 py-3 text-xs">
                <p className="font-bold text-red-700">현재 제재 중</p>
                <p className="mt-1 text-slate-700">{user.sanctionReason ?? "사유 없음"}</p>
                {user.sanctionedAt ? (
                  <p className="mt-1 text-[10px] text-slate-400">
                    적용일 {formatDate(user.sanctionedAt)}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void liftSanction()}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                제재 해제
              </button>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
