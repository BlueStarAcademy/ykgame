"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "./AdminShell";

interface ProbabilityTableRow {
  level: string;
  value: string;
}

interface ProbabilityTable {
  columns: [string, string];
  rows: ProbabilityTableRow[];
}

interface ProbabilityItem {
  label: string;
  value: string;
  detail?: string;
  table?: ProbabilityTable;
}

interface ProbabilitySection {
  title: string;
  items: ProbabilityItem[];
}

interface ProbabilityReport {
  title: string;
  sections: ProbabilitySection[];
}

type ProbabilityTabId = "rewards" | "truck" | "upgrade";

const PROBABILITY_TABS: {
  id: ProbabilityTabId;
  label: string;
  sectionTitles: string[];
}[] = [
  {
    id: "rewards",
    label: "점수 · 보상",
    sectionTitles: ["기본 점수", "하역 보상 확률 (1회 롤)"],
  },
  {
    id: "truck",
    label: "덤프트럭",
    sectionTitles: ["덤프트럭 하역 시스템"],
  },
  {
    id: "upgrade",
    label: "장비강화",
    sectionTitles: ["장비강화 효과", "강화 비용 공식"],
  },
];

function ProbabilityTableCard({
  title,
  summary,
  table,
}: {
  title: string;
  summary: string;
  table: ProbabilityTable;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold text-slate-700">{title}</p>
        <p className="text-[10px] font-semibold text-slate-400">{summary}</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
          <span>{table.columns[0]}</span>
          <span className="text-right">{table.columns[1]}</span>
        </div>
        <div className="max-h-56 overflow-y-auto">
          {table.rows.map((row) => (
            <div
              key={`${row.level}-${row.value}`}
              className="grid grid-cols-2 border-b border-slate-50 px-3 py-1.5 last:border-b-0"
            >
              <span className="text-[11px] font-semibold text-slate-500">{row.level}</span>
              <span className="text-right text-[11px] font-bold tabular-nums text-slate-800">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProbabilitySectionCard({
  section,
  compactTables = false,
}: {
  section: ProbabilitySection;
  compactTables?: boolean;
}) {
  const summaryItems = section.items.filter((item) => !item.table);
  const tableItems = section.items.filter((item) => item.table);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-black text-slate-900">{section.title}</h3>

      {summaryItems.length > 0 ? (
        <div className="mt-3 space-y-2">
          {summaryItems.map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-100 px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-xs font-semibold text-slate-600">{item.label}</p>
                <p className="max-w-[55%] shrink-0 text-right text-sm font-black leading-snug text-slate-900">
                  {item.value}
                </p>
              </div>
              {item.detail ? (
                <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{item.detail}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {tableItems.length > 0 ? (
        <div
          className={`mt-3 grid gap-3 ${
            compactTables ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
          }`}
        >
          {tableItems.map((item) =>
            item.table ? (
              <ProbabilityTableCard
                key={item.label}
                title={item.label}
                summary={item.value}
                table={item.table}
              />
            ) : null,
          )}
        </div>
      ) : null}
    </section>
  );
}

export function AdminProbabilityPanel() {
  return (
    <AdminShell title="확률정보" subtitle="현재 적용 중인 게임 보상 확률을 확인합니다.">
      <AdminProbabilityPanelContent />
    </AdminShell>
  );
}

export function AdminProbabilityPanelContent() {
  const [report, setReport] = useState<ProbabilityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProbabilityTabId>("rewards");

  useEffect(() => {
    fetch("/api/admin/probability")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setReport(data.yanmar ?? null))
      .finally(() => setLoading(false));
  }, []);

  const activeSections = useMemo(() => {
    if (!report) return [];
    const tab = PROBABILITY_TABS.find((item) => item.id === activeTab);
    if (!tab) return [];
    return report.sections.filter((section) => tab.sectionTitles.includes(section.title));
  }, [activeTab, report]);

  if (loading) {
    return <p className="py-10 text-center text-sm text-slate-400">불러오는 중...</p>;
  }
  if (!report) {
    return <p className="py-10 text-center text-sm text-slate-400">확률 정보가 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500">
          Yanmar
        </p>
        <h2 className="mt-1 text-lg font-black text-slate-900">{report.title}</h2>
      </div>

      <div
        className="grid grid-cols-3 gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1.5"
        role="tablist"
        aria-label="확률정보 분류"
      >
        {PROBABILITY_TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-2 py-2.5 text-[11px] font-bold transition ${
                selected
                  ? "bg-white text-violet-700 shadow-sm ring-1 ring-violet-200"
                  : "text-slate-500 hover:bg-white/70 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-4" role="tabpanel">
        {activeSections.length > 0 ? (
          activeSections.map((section) => (
            <ProbabilitySectionCard
              key={section.title}
              section={section}
              compactTables={activeTab === "truck"}
            />
          ))
        ) : (
          <p className="py-8 text-center text-sm text-slate-400">
            이 분류에 표시할 항목이 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}
