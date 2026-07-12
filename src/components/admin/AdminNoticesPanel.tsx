"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "./AdminShell";

type TickerNotice = {
  id: string;
  message: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export function AdminNoticesPanel() {
  const [notices, setNotices] = useState<TickerNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/notices");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "불러오기 실패");
      setNotices(data.notices ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createNotice() {
    if (!draft.trim()) {
      alert("공지 내용을 입력해주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "등록 실패");
      setDraft("");
      setNotices((prev) => [...prev, data.notice]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "등록 실패");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/notices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: editMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "수정 실패");
      setNotices((prev) =>
        prev.map((item) => (item.id === id ? data.notice : item)),
      );
      setEditingId(null);
      setEditMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "수정 실패");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(notice: TickerNotice) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/notices/${notice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !notice.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "상태 변경 실패");
      setNotices((prev) =>
        prev.map((item) => (item.id === notice.id ? data.notice : item)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "상태 변경 실패");
    } finally {
      setSaving(false);
    }
  }

  async function removeNotice(id: string) {
    if (!confirm("이 공지를 삭제할까요?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/notices/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "삭제 실패");
      setNotices((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setSaving(false);
    }
  }

  async function moveNotice(id: string, direction: -1 | 1) {
    const index = notices.findIndex((item) => item.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= notices.length) return;

    const reordered = [...notices];
    const [item] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, item);
    setNotices(reordered);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/notices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: reordered.map((n) => n.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "순서 변경 실패");
      setNotices(data.notices ?? reordered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "순서 변경 실패");
      void load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      title="전광판 공지"
      subtitle="게임 상단 전광판에 표시할 공지를 작성·정렬합니다. 쿠폰·스타 당첨 알림과 함께 순환됩니다."
    >
      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-slate-900">새 공지 작성</h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={draft}
              maxLength={160}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="예: 이번 주말 스타 2배 이벤트 진행 중!"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void createNotice()}
              className="shrink-0 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              등록
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            {draft.length}/160 · 활성 공지만 전광판에 표시됩니다.
          </p>
        </section>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-black text-slate-900">공지 목록</h2>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600"
            >
              새로고침
            </button>
          </div>

          {loading ? (
            <p className="mt-4 text-xs text-slate-500">불러오는 중…</p>
          ) : notices.length === 0 ? (
            <p className="mt-4 text-xs text-slate-500">등록된 공지가 없습니다.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {notices.map((notice, index) => (
                <li
                  key={notice.id}
                  className={`rounded-xl border px-3 py-2.5 ${
                    notice.active
                      ? "border-amber-200 bg-amber-50/60"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  {editingId === notice.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editMessage}
                        maxLength={160}
                        onChange={(e) => setEditMessage(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void saveEdit(notice.id)}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white"
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditMessage("");
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-black tabular-nums text-slate-500 shadow-sm">
                          #{index + 1}
                        </span>
                        <p className="min-w-0 flex-1 text-sm font-semibold text-slate-800">
                          {notice.message}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            notice.active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          {notice.active ? "표시중" : "숨김"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={saving || index === 0}
                          onClick={() => void moveNotice(notice.id, -1)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 disabled:opacity-40"
                        >
                          ↑ 위로
                        </button>
                        <button
                          type="button"
                          disabled={saving || index === notices.length - 1}
                          onClick={() => void moveNotice(notice.id, 1)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 disabled:opacity-40"
                        >
                          ↓ 아래로
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setEditingId(notice.id);
                            setEditMessage(notice.message);
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void toggleActive(notice)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700"
                        >
                          {notice.active ? "숨기기" : "표시"}
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void removeNotice(notice.id)}
                          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700"
                        >
                          삭제
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
