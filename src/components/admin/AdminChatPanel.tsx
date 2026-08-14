"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "./AdminShell";
import {
  CHAT_CHANNEL_MAX,
  CHAT_CHANNEL_MIN,
} from "@/lib/chat-constants";

type AdminChatMessage = {
  id: string;
  kind: "USER" | "SYSTEM";
  channel: number | null;
  nickname: string | null;
  body: string;
  hidden: boolean;
  createdAt: string;
  user: {
    id: string;
    loginId: string;
    nickname: string | null;
    isActive: boolean;
  } | null;
};

export function AdminChatPanel() {
  const [messages, setMessages] = useState<AdminChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<"all" | number>("all");
  const [nickname, setNickname] = useState("");
  const [includeHidden, setIncludeHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (channel !== "all") params.set("channel", String(channel));
      if (nickname.trim()) params.set("nickname", nickname.trim());
      if (includeHidden) params.set("hidden", "1");
      const res = await fetch(`/api/admin/chat?${params.toString()}`);
      const data = (await res.json()) as {
        messages?: AdminChatMessage[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "불러오기 실패");
      setMessages(data.messages ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "불러오기 실패");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [channel, nickname, includeHidden]);

  useEffect(() => {
    void load();
  }, [load]);

  async function hideMessage(id: string) {
    if (!confirm("이 메시지를 숨길까요? 채팅창에서 즉시 사라집니다.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/chat/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "숨기기 실패");
      if (includeHidden) {
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, hidden: true } : m)),
        );
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "숨기기 실패");
    } finally {
      setBusyId(null);
    }
  }

  const channelOptions = Array.from(
    { length: CHAT_CHANNEL_MAX - CHAT_CHANNEL_MIN + 1 },
    (_, i) => CHAT_CHANNEL_MIN + i,
  );

  return (
    <AdminShell
      title="채팅 관리"
      subtitle="채널 채팅과 시스템 안내를 조회하고 부적절한 메시지를 숨깁니다. 공지는 ‘채팅 공지’ 메뉴에서 관리합니다."
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <label className="text-[11px] font-bold text-slate-500">
            채널
            <select
              className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              value={channel === "all" ? "all" : String(channel)}
              onChange={(e) => {
                const v = e.target.value;
                setChannel(v === "all" ? "all" : Number(v));
              }}
            >
              <option value="all">전체</option>
              {channelOptions.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}채널
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-bold text-slate-500">
            닉네임
            <input
              className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="검색"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
            <input
              type="checkbox"
              checked={includeHidden}
              onChange={(e) => setIncludeHidden(e.target.checked)}
            />
            숨김 포함
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
          >
            새로고침
          </button>
        </div>

        {error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : null}

        {loading ? (
          <p className="py-10 text-center text-sm text-slate-400">불러오는 중...</p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">메시지가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`px-3 py-3 ${m.hidden ? "bg-slate-50 opacity-70" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold text-slate-400">
                      <span>
                        {m.channel == null ? "전체" : `${m.channel}채널`}
                      </span>
                      <span>{m.kind}</span>
                      <span>{new Date(m.createdAt).toLocaleString("ko-KR")}</span>
                      {m.hidden ? (
                        <span className="text-rose-500">숨김</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-900">
                      {m.kind === "USER" ? (
                        <span className="font-bold text-slate-700">
                          {m.nickname ?? "익명"}:{" "}
                        </span>
                      ) : null}
                      {m.body}
                    </p>
                    {m.user ? (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {m.user.loginId}
                        {m.user.isActive ? "" : " · 제재됨"} ·{" "}
                        <Link
                          href={`/admin/users/${m.user.id}`}
                          className="font-bold text-blue-600 underline"
                        >
                          회원 상세
                        </Link>
                      </p>
                    ) : null}
                  </div>
                  {!m.hidden ? (
                    <button
                      type="button"
                      disabled={busyId === m.id}
                      onClick={() => void hideMessage(m.id)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 disabled:opacity-50"
                    >
                      숨기기
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
