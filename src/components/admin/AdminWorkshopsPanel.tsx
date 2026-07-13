"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "./AdminShell";

type WorkshopId = "dig" | "dump" | "crash" | "hill";
type WorkshopAccent = "amber" | "sky" | "orange" | "emerald";

interface WorkshopActivity {
  id: string;
  type: "STAR" | "COUPON";
  amount: number;
  score: number | null;
  xpGained: number | null;
  eventId: string | null;
  couponType: string | null;
  createdAt: string;
  user: {
    id: string;
    loginId: string;
    nickname: string | null;
  };
}

interface WorkshopInfo {
  id: WorkshopId;
  gameId: string | null;
  label: string;
  shortLabel: string;
  code: string;
  unlockLevel: number;
  attachment: string;
  mapArea: string;
  accent: WorkshopAccent;
  task: string;
  rewardRule: string;
  operationRule: string;
  stats: {
    activityCount: number;
    participantCount: number;
    starRewardCount: number;
    couponCount: number;
    starsGranted: number;
    xpGranted: number;
    scoreGranted: number;
  };
  recent: WorkshopActivity[];
}

interface WorkshopsReport {
  generatedAt: string;
  workshops: WorkshopInfo[];
}

const ACCENT_STYLES: Record<
  WorkshopAccent,
  {
    header: string;
    tab: string;
    badge: string;
    icon: string;
  }
> = {
  amber: {
    header: "border-amber-200 bg-gradient-to-br from-amber-50 to-white",
    tab: "text-amber-800 ring-amber-200",
    badge: "bg-amber-100 text-amber-800",
    icon: "⛏️",
  },
  sky: {
    header: "border-sky-200 bg-gradient-to-br from-sky-50 to-white",
    tab: "text-sky-800 ring-sky-200",
    badge: "bg-sky-100 text-sky-800",
    icon: "🚚",
  },
  orange: {
    header: "border-orange-200 bg-gradient-to-br from-orange-50 to-white",
    tab: "text-orange-800 ring-orange-200",
    badge: "bg-orange-100 text-orange-800",
    icon: "🔨",
  },
  emerald: {
    header: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white",
    tab: "text-emerald-800 ring-emerald-200",
    badge: "bg-emerald-100 text-emerald-800",
    icon: "🪨",
  },
};

const COUPON_LABELS: Record<string, string> = {
  YK_PARTS_DISCOUNT: "부품 할인",
  EQUIPMENT_RENTAL_DISCOUNT: "장비 임대 할인",
  FILTER_SET_EXCHANGE: "필터세트 교환",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatActivityReward(activity: WorkshopActivity) {
  if (activity.type === "STAR") return `스타 ${formatNumber(activity.amount)}개`;
  return COUPON_LABELS[activity.couponType ?? ""] ?? "쿠폰";
}

export function AdminWorkshopsPanel() {
  return (
    <AdminShell
      title="작업장 정보"
      subtitle="얀마 작업장을 분류해 운영 규칙과 실제 활동 현황을 확인합니다."
    >
      <AdminWorkshopsPanelContent />
    </AdminShell>
  );
}

export function AdminWorkshopsPanelContent() {
  const [report, setReport] = useState<WorkshopsReport | null>(null);
  const [activeId, setActiveId] = useState<WorkshopId>("dig");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/workshops", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load workshops");
        return response.json() as Promise<WorkshopsReport>;
      })
      .then((data) => {
        setReport(data);
        setActiveId(data.workshops[0]?.id ?? "dig");
        setError(false);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== "AbortError") setError(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const activeWorkshop = useMemo(
    () => report?.workshops.find((workshop) => workshop.id === activeId) ?? null,
    [activeId, report],
  );

  const totals = useMemo(() => {
    return (report?.workshops ?? []).reduce(
      (sum, workshop) => ({
        activities: sum.activities + workshop.stats.activityCount,
        stars: sum.stars + workshop.stats.starsGranted,
        coupons: sum.coupons + workshop.stats.couponCount,
      }),
      { activities: 0, stars: 0, coupons: 0 },
    );
  }, [report]);

  if (loading) {
    return <p className="py-10 text-center text-sm text-slate-400">불러오는 중...</p>;
  }

  if (error || !report) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-8 text-center">
        <p className="text-sm font-bold text-red-700">작업장 정보를 불러오지 못했습니다.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          Yanmar workshop overview
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ["총 작업", totals.activities],
            ["지급 스타", totals.stars],
            ["발급 쿠폰", totals.coupons],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white/8 px-2 py-2.5 text-center">
              <p className="text-[10px] font-semibold text-slate-400">{label}</p>
              <p className="mt-1 text-base font-black tabular-nums">
                {formatNumber(value as number)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div
        className="grid grid-cols-4 gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1.5"
        role="tablist"
        aria-label="작업장 분류"
      >
        {report.workshops.map((workshop) => {
          const selected = activeId === workshop.id;
          const styles = ACCENT_STYLES[workshop.accent];
          return (
            <button
              key={workshop.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveId(workshop.id)}
              className={`rounded-xl px-1 py-2.5 text-[11px] font-black transition ${
                selected
                  ? `bg-white shadow-sm ring-1 ${styles.tab}`
                  : "text-slate-500 hover:bg-white/70"
              }`}
            >
              <span className="block text-base" aria-hidden>
                {styles.icon}
              </span>
              <span className="mt-0.5 block">{workshop.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {activeWorkshop ? (
        <div className="space-y-4" role="tabpanel">
          <section
            className={`rounded-2xl border p-4 shadow-sm ${
              ACCENT_STYLES[activeWorkshop.accent].header
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-slate-400">
                  {activeWorkshop.code}
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-900">
                  {activeWorkshop.label}
                </h2>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${
                  ACCENT_STYLES[activeWorkshop.accent].badge
                }`}
              >
                Lv.{activeWorkshop.unlockLevel} 해금
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white/80 px-3 py-2.5">
                <p className="text-[10px] text-slate-400">전용 부착물</p>
                <p className="mt-0.5 font-black text-slate-800">{activeWorkshop.attachment}</p>
              </div>
              <div className="rounded-xl bg-white/80 px-3 py-2.5">
                <p className="text-[10px] text-slate-400">맵 구역</p>
                <p className="mt-0.5 font-black text-slate-800">{activeWorkshop.mapArea}</p>
              </div>
            </div>
            <dl className="mt-3 space-y-2 rounded-xl bg-white/70 px-3 py-3 text-xs">
              <div>
                <dt className="font-bold text-slate-400">작업</dt>
                <dd className="mt-0.5 font-semibold text-slate-700">{activeWorkshop.task}</dd>
              </div>
              <div>
                <dt className="font-bold text-slate-400">보상</dt>
                <dd className="mt-0.5 font-semibold text-slate-700">
                  {activeWorkshop.rewardRule}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-400">운영 규칙</dt>
                <dd className="mt-0.5 font-semibold text-slate-700">
                  {activeWorkshop.operationRule}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-900">누적 현황</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                ["작업 횟수", activeWorkshop.stats.activityCount],
                ["참여 회원", activeWorkshop.stats.participantCount],
                ["누적 XP", activeWorkshop.stats.xpGranted],
                ["누적 점수", activeWorkshop.stats.scoreGranted],
                ["지급 스타", activeWorkshop.stats.starsGranted],
                ["발급 쿠폰", activeWorkshop.stats.couponCount],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-slate-400">{label}</p>
                  <p className="mt-1 text-base font-black tabular-nums text-slate-900">
                    {formatNumber(value as number)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-slate-900">최근 작업 기록</h3>
              <span className="text-[10px] text-slate-400">최근 15건</span>
            </div>
            {activeWorkshop.recent.length > 0 ? (
              <div className="mt-3 divide-y divide-slate-100">
                {activeWorkshop.recent.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/users/${activity.user.id}`}
                        className="truncate text-xs font-black text-slate-800 hover:underline"
                      >
                        {activity.user.nickname ?? activity.user.loginId}
                      </Link>
                      <p className="mt-0.5 truncate text-[10px] text-slate-400">
                        {activity.eventId ? `${activity.eventId} · ` : ""}
                        {activity.score != null
                          ? `점수 ${formatNumber(activity.score)} · `
                          : ""}
                        {new Date(activity.createdAt).toLocaleString("ko-KR")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-black text-slate-700">
                        {formatActivityReward(activity)}
                      </p>
                      {activity.xpGained != null ? (
                        <p className="text-[10px] font-bold text-violet-500">
                          XP +{formatNumber(activity.xpGained)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">
                아직 기록된 작업이 없습니다.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
