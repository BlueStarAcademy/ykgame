"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "./AdminShell";

interface UserRow {
  id: string;
  loginId: string;
  nickname: string | null;
  isActive: boolean;
}

export function AdminUsersList() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadUsers(q = search) {
    setLoading(true);
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <AdminShell title="회원관리" subtitle="아이디와 닉네임을 확인하고 상세 관리로 이동하세요.">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="아이디, 닉네임 검색"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          />
          <button
            type="button"
            onClick={() => loadUsers(search)}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
          >
            검색
          </button>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-slate-400">불러오는 중...</p>
        ) : users.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">회원이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <Link
                key={user.id}
                href={`/admin/users/${user.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{user.loginId}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {user.nickname ?? "닉네임 없음"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      user.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {user.isActive ? "정상" : "정지"}
                  </span>
                  <span className="text-xs font-bold text-blue-600">상세보기 →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
