"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface AdminShellProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  /** Prefer this over Link when returning to in-game (e.g. hard navigation + resume). */
  onBack?: () => void;
  children: ReactNode;
}

export function AdminShell({
  title,
  subtitle,
  backHref = "/admin",
  backLabel,
  onBack,
  children,
}: AdminShellProps) {
  const resolvedBackLabel =
    backLabel ??
    (onBack
      ? "뒤로가기"
      : backHref === "/admin"
        ? "관리자 홈"
        : backHref === "/home"
          ? "뒤로가기"
          : "뒤로");

  return (
    <main className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <span aria-hidden>←</span>
                {resolvedBackLabel}
              </button>
            ) : (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <span aria-hidden>←</span>
                {resolvedBackLabel}
              </Link>
            )}
            <h1 className="mt-3 text-2xl font-black text-slate-900">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
