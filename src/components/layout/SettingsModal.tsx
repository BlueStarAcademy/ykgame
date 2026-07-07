"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { data: session, update } = useSession();
  const [loginId, setLoginId] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    fetch("/api/user/profile")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setLoginId(data.user?.loginId ?? "");
        setNickname(data.user?.nickname ?? session?.user?.nickname ?? "");
      })
      .catch(() => {
        if (!cancelled) {
          setLoginId("");
          setNickname(session?.user?.nickname ?? "");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, session?.user?.nickname]);

  if (!open) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "설정 저장에 실패했습니다.");
        return;
      }
      await update({ user: { nickname: data.nickname, currency: data.currency } });
      onClose();
    } catch {
      setError("설정 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppModalOverlay open={open} onClose={onClose}>
      <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-slate-700 px-4 py-3 text-white">
          <h2 className="text-base font-black">설정</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-bold hover:bg-white/30"
          >
            닫기
          </button>
        </div>

        {loading ? (
          <p className="py-10 text-center text-xs text-gray-400">설정 불러오는 중...</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 p-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">아이디</label>
              <input
                type="text"
                value={loginId}
                readOnly
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">닉네임</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                placeholder="닉네임 (2~12자)"
                minLength={2}
                maxLength={12}
                required
              />
            </div>

            {error ? <p className="text-xs text-red-500">{error}</p> : null}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </form>
        )}
      </div>
    </AppModalOverlay>
  );
}
