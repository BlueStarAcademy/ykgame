"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

export function CustomerInquiryModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!open || typeof document === "undefined") return null;

  async function submit() {
    if (!title.trim() || !body.trim()) {
      setError("제목과 내용을 입력해주세요.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "접수 실패");
      setDone(true);
      setTitle("");
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "접수 실패");
    } finally {
      setSending(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-slate-950 text-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="고객문의"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-black">고객문의</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white"
          >
            닫기
          </button>
        </div>

        {done ? (
          <div className="space-y-4 px-4 py-5">
            <p className="text-sm font-bold text-emerald-300">문의가 접수되었습니다.</p>
            <p className="text-xs leading-relaxed text-white/65">
              운영팀이 확인 후 조치합니다. 추가 문의가 있으면 다시 작성해 주세요.
            </p>
            <button
              type="button"
              onClick={() => {
                setDone(false);
                onClose();
              }}
              className="w-full rounded-xl bg-white py-2.5 text-sm font-black text-slate-900"
            >
              확인
            </button>
          </div>
        ) : (
          <div className="space-y-3 px-4 py-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="제목"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/35"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              rows={6}
              placeholder="문의 내용을 적어 주세요"
              className="w-full resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/35"
            />
            {error ? <p className="text-xs font-bold text-rose-300">{error}</p> : null}
            <button
              type="button"
              disabled={sending}
              onClick={() => void submit()}
              className="w-full rounded-xl bg-sky-500 py-2.5 text-sm font-black text-white hover:bg-sky-400 disabled:opacity-60"
            >
              {sending ? "접수 중..." : "문의 접수"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
