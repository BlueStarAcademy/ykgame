"use client";

import { useEffect, useState } from "react";

interface GearSummary {
  inventoryCap: number;
  totalGear: number;
  usersWithGear: number;
  byGrade: { grade: string; gradeLabel: string; count: number }[];
  topHolders: {
    userId: string;
    loginId: string;
    nickname: string | null;
    gearCount: number;
    enhanceCores: number;
    currency: number;
  }[];
  recentPulls: {
    id: string;
    banner: string;
    count: number;
    createdAt: string;
    user: { id: string; loginId: string; nickname: string | null };
    results: unknown;
  }[];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function summarizeResults(results: unknown) {
  if (!Array.isArray(results)) return "-";
  return results
    .map((r) => {
      if (r && typeof r === "object" && "grade" in r && "nameSnapshot" in r) {
        const row = r as { grade: string; nameSnapshot: string };
        return `${row.grade}:${row.nameSnapshot}`;
      }
      return "?";
    })
    .join(", ");
}

export function AdminYanmarGearPanelContent() {
  const [data, setData] = useState<GearSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/admin/yanmar-gear")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json) => {
        if (!cancelled) setData(json as GearSummary);
      })
      .catch(() => {
        if (!cancelled) setError("장비/가챠 현황을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-400">불러오는 중...</p>;
  }
  if (error || !data) {
    return (
      <p className="py-8 text-center text-sm text-red-500">
        {error ?? "데이터 없음"}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[11px] text-slate-400">전체 장비</p>
          <p className="mt-0.5 text-lg font-black text-slate-900">
            {data.totalGear.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[11px] text-slate-400">보유 유저</p>
          <p className="mt-0.5 text-lg font-black text-slate-900">
            {data.usersWithGear.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[11px] text-slate-400">인벤 상한</p>
          <p className="mt-0.5 text-lg font-black text-slate-900">{data.inventoryCap}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black text-slate-900">등급별 장비 수</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.byGrade.map((g) => (
            <span
              key={g.grade}
              className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700"
            >
              {g.gradeLabel} {g.count.toLocaleString()}
            </span>
          ))}
          {data.byGrade.length === 0 ? (
            <p className="text-xs text-slate-400">데이터 없음</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black text-slate-900">장비 보유 TOP</h3>
        <div className="mt-3 space-y-2">
          {data.topHolders.map((h) => (
            <a
              key={h.userId}
              href={`/admin/users/${h.userId}`}
              className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-xs hover:bg-slate-50"
            >
              <span className="font-bold text-slate-800">
                {h.nickname || h.loginId}
              </span>
              <span className="text-slate-500">
                장비 {h.gearCount} · 강화코어 {h.enhanceCores} · ★{h.currency}
              </span>
            </a>
          ))}
          {data.topHolders.length === 0 ? (
            <p className="text-xs text-slate-400">데이터 없음</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black text-slate-900">최근 가챠</h3>
        <div className="mt-3 space-y-2">
          {data.recentPulls.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-slate-100 px-3 py-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-800">
                  {p.user.nickname || p.user.loginId} · {p.banner} ×{p.count}
                </span>
                <span className="shrink-0 text-slate-400">
                  {formatDate(p.createdAt)}
                </span>
              </div>
              <p className="mt-1 break-all text-slate-500">
                {summarizeResults(p.results)}
              </p>
            </div>
          ))}
          {data.recentPulls.length === 0 ? (
            <p className="text-xs text-slate-400">가챠 기록 없음</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
