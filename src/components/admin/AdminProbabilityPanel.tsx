"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "./AdminShell";

interface ProbabilityItem {
  label: string;
  value: string;
  detail?: string;
}

interface ProbabilitySection {
  title: string;
  items: ProbabilityItem[];
}

interface ProbabilityReport {
  title: string;
  sections: ProbabilitySection[];
}

export function AdminProbabilityPanel() {
  const [report, setReport] = useState<ProbabilityReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/probability")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setReport(data.yanmar ?? null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminShell title="확률정보" subtitle="현재 적용 중인 게임 보상 확률을 확인합니다.">
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">불러오는 중...</p>
      ) : !report ? (
        <p className="py-10 text-center text-sm text-slate-400">확률 정보가 없습니다.</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500">Yanmar</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">{report.title}</h2>
          </div>

          {report.sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h3 className="text-sm font-black text-slate-900">{section.title}</h3>
              <div className="mt-3 space-y-2">
                {section.items.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-slate-100 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-semibold text-slate-600">{item.label}</p>
                      <p className="shrink-0 text-sm font-black text-slate-900">{item.value}</p>
                    </div>
                    {item.detail ? (
                      <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{item.detail}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
