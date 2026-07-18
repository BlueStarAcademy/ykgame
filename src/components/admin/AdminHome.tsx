"use client";

import Link from "next/link";
import { AdminShell } from "./AdminShell";
import { ADMIN_MENU_ITEMS } from "./adminMenu";
import { markResumeInGame } from "@/lib/resumeInGame";

export function AdminHome() {
  return (
    <AdminShell
      title="관리자 패널"
      subtitle="관리 메뉴를 선택하세요."
      backLabel="뒤로가기"
      onBack={() => {
        markResumeInGame();
        window.location.assign("/home?resume=1");
      }}
    >
      <div className="grid gap-3">
        {ADMIN_MENU_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-4 rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${item.color}`}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
              {item.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-black text-slate-900">{item.title}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{item.desc}</span>
            </span>
            <span className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
              입장
            </span>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
