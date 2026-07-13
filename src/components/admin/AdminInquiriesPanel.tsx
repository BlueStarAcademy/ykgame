"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatInquiryDate,
  INQUIRY_STATUS_LABELS,
  type InquiryStatusKey,
} from "@/lib/inquiries";
import { AdminShell } from "./AdminShell";

interface InquiryListItem {
  id: string;
  title: string;
  status: InquiryStatusKey;
  createdAt: string;
  user: {
    id: string;
    loginId: string;
    nickname: string | null;
  };
}

export function AdminInquiriesPanel() {
  const [inquiries, setInquiries] = useState<InquiryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"" | InquiryStatusKey>("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const query = statusFilter ? `?status=${statusFilter}` : "";
    fetch(`/api/admin/inquiries${query}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setInquiries(data.inquiries ?? []))
      .catch((err: unknown) => {
        if ((err as { name?: string }).name === "AbortError") return;
        setInquiries([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [statusFilter]);

  return (
    <AdminShell
      title="고객문의 관리"
      subtitle="인게임에서 접수된 문의를 확인하고 조치합니다."
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["", "전체"],
              ["OPEN", "접수"],
              ["IN_PROGRESS", "처리중"],
              ["RESOLVED", "해결"],
              ["CLOSED", "종료"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value || "all"}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${
                statusFilter === value
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-slate-400">불러오는 중...</p>
        ) : inquiries.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">문의가 없습니다.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="hidden grid-cols-[minmax(0,1.4fr)_5.5rem_5.5rem_7.5rem_3.5rem] gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-400 sm:grid">
              <span>제목</span>
              <span>아이디</span>
              <span>닉네임</span>
              <span>날짜</span>
              <span>상태</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {inquiries.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/admin/inquiries/${item.id}`}
                    className="grid grid-cols-1 gap-1 px-3 py-3 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1.4fr)_5.5rem_5.5rem_7.5rem_3.5rem] sm:items-center sm:gap-2"
                  >
                    <span className="min-w-0 truncate text-sm font-bold text-slate-900">
                      {item.title}
                    </span>
                    <span className="truncate text-[11px] font-semibold text-slate-600">
                      {item.user.loginId}
                    </span>
                    <span className="truncate text-[11px] font-semibold text-slate-600">
                      {item.user.nickname ?? "-"}
                    </span>
                    <span className="text-[11px] tabular-nums text-slate-500">
                      {formatInquiryDate(item.createdAt)}
                    </span>
                    <span className="text-[10px] font-black text-indigo-600">
                      {INQUIRY_STATUS_LABELS[item.status]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
