"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminShell } from "./AdminShell";
import { AdminProbabilityPanelContent } from "./AdminProbabilityPanel";
import { AdminQuestsPanelContent } from "./AdminQuestsPanel";
import { AdminWorkshopsPanelContent } from "./AdminWorkshopsPanel";

import { AdminYanmarGearPanelContent } from "./AdminYanmarGearPanel";

type GameInfoTabId = "probability" | "quests" | "workshops" | "gear";

const GAME_INFO_TABS: {
  id: GameInfoTabId;
  label: string;
  emoji: string;
}[] = [
  { id: "probability", label: "확률정보", emoji: "🎲" },
  { id: "quests", label: "퀘스트", emoji: "📋" },
  { id: "workshops", label: "작업장", emoji: "🏗️" },
  { id: "gear", label: "장비·가챠", emoji: "⚙️" },
];

function resolveInitialTab(value: string | null): GameInfoTabId {
  if (
    value === "quests" ||
    value === "workshops" ||
    value === "probability" ||
    value === "gear"
  ) {
    return value;
  }
  return "probability";
}

export function AdminGameInfoPanel() {
  const searchParams = useSearchParams();
  const initialTab = resolveInitialTab(searchParams.get("tab"));
  const [activeTab, setActiveTab] = useState<GameInfoTabId>(initialTab);

  return (
    <AdminShell
      title="게임정보"
      subtitle="확률·퀘스트·작업장·장비/가챠 정보를 한곳에서 확인합니다."
    >
      <div className="space-y-4">
        <div
          className="grid grid-cols-4 gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1.5"
          role="tablist"
          aria-label="게임정보 분류"
        >
          {GAME_INFO_TABS.map((tab) => {
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
                    ? "bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200"
                    : "text-slate-500 hover:bg-white/70 hover:text-slate-700"
                }`}
              >
                <span className="mr-1" aria-hidden>
                  {tab.emoji}
                </span>
                {tab.label}
              </button>
            );
          })}
        </div>

        <div role="tabpanel">
          {activeTab === "probability" ? <AdminProbabilityPanelContent /> : null}
          {activeTab === "quests" ? <AdminQuestsPanelContent /> : null}
          {activeTab === "workshops" ? <AdminWorkshopsPanelContent /> : null}
          {activeTab === "gear" ? <AdminYanmarGearPanelContent /> : null}
        </div>
      </div>
    </AdminShell>
  );
}
