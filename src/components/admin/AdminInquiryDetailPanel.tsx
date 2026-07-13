"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatInquiryDate,
  INQUIRY_STATUS_LABELS,
  type InquiryStatusKey,
} from "@/lib/inquiries";
import { AdminShell } from "./AdminShell";

interface InquiryDetail {
  id: string;
  title: string;
  body: string;
  status: InquiryStatusKey;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    loginId: string;
    nickname: string | null;
    email: string;
    isActive: boolean;
  };
}

export function AdminInquiryDetailPanel({ inquiryId }: { inquiryId: string }) {
  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<InquiryStatusKey>("OPEN");
  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/inquiries/${inquiryId}`);
    const data = await res.json();
    const next = data.inquiry as InquiryDetail | undefined;
    setInquiry(next ?? null);
    if (next) {
      setStatus(next.status);
      setAdminNote(next.adminNote ?? "");
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [inquiryId]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          adminNote: adminNote.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      setMessage("조치 내용을 저장했습니다.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminShell title="문의 상세" backHref="/admin/inquiries">
        <p className="py-10 text-center text-sm text-slate-400">불러오는 중...</p>
      </AdminShell>
    );
  }

  if (!inquiry) {
    return (
      <AdminShell title="문의 상세" backHref="/admin/inquiries">
        <p className="py-10 text-center text-sm text-slate-400">문의를 찾을 수 없습니다.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={inquiry.title}
      subtitle={`${inquiry.user.loginId} · ${formatInquiryDate(inquiry.createdAt)}`}
      backHref="/admin/inquiries"
      backLabel="문의 목록"
    >
      <div className="space-y-4">
        {message ? (
          <p className="rounded-xl bg-slate-900 px-4 py-3 text-center text-xs font-bold text-white">
            {message}
          </p>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">작성자</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-slate-400">아이디</dt>
              <dd className="mt-0.5 font-bold text-slate-800">{inquiry.user.loginId}</dd>
            </div>
            <div>
              <dt className="text-slate-400">닉네임</dt>
              <dd className="mt-0.5 font-bold text-slate-800">
                {inquiry.user.nickname ?? "-"}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-400">이메일</dt>
              <dd className="mt-0.5 font-bold text-slate-800">{inquiry.user.email}</dd>
            </div>
            <div>
              <dt className="text-slate-400">계정 상태</dt>
              <dd
                className={`mt-0.5 font-bold ${
                  inquiry.user.isActive ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {inquiry.user.isActive ? "정상" : "제재 중"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">회원 상세</dt>
              <dd className="mt-0.5">
                <Link
                  href={`/admin/users/${inquiry.user.id}`}
                  className="font-bold text-indigo-600 hover:underline"
                >
                  바로가기
                </Link>
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">문의 내용</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
            {inquiry.body}
          </p>
          <p className="mt-3 text-[10px] text-slate-400">
            접수 {formatInquiryDate(inquiry.createdAt)} · 상태{" "}
            {INQUIRY_STATUS_LABELS[inquiry.status]}
          </p>
        </section>

        <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">조치</h2>
          <div className="mt-3 space-y-3">
            <label className="block text-xs font-bold text-slate-600">
              상태
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as InquiryStatusKey)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800"
              >
                {(Object.keys(INQUIRY_STATUS_LABELS) as InquiryStatusKey[]).map(
                  (key) => (
                    <option key={key} value={key}>
                      {INQUIRY_STATUS_LABELS[key]}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="block text-xs font-bold text-slate-600">
              관리자 메모
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={4}
                placeholder="조치 내용·메모를 남겨 주세요"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800"
              />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-black text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {saving ? "저장 중..." : "조치 저장"}
            </button>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
