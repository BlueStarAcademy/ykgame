"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clientLogout } from "@/lib/client-logout";

interface UserRow {
  id: string;
  loginId: string;
  email: string;
  nickname: string | null;
  role: string;
  currency: number;
  isActive: boolean;
  createdAt: string;
  _count: { gameScores: number };
}

export function AdminPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [bulkAmount, setBulkAmount] = useState(10);

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

  async function updateCurrency(userId: string, amount: number, mode: "add" | "set" = "add") {
    await fetch("/api/admin/currency", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, amount, mode }),
    });
    loadUsers();
  }

  async function toggleActive(user: UserRow) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, isActive: !user.isActive }),
    });
    loadUsers();
  }

  async function bulkGrant() {
    await fetch("/api/admin/currency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: bulkAmount }),
    });
    loadUsers();
    alert(`모든 활성 사용자에게 ${bulkAmount}별 지급 완료`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">관리자 패널</h1>
        <div className="flex gap-2">
          <Link
            href="/home"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            홈으로
          </Link>
          <button
            onClick={() => clientLogout()}
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300"
          >
            로그아웃
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow">
        <h2 className="mb-3 font-semibold">재화 일괄 지급</h2>
        <div className="flex gap-2">
          <input
            type="number"
            value={bulkAmount}
            onChange={(e) => setBulkAmount(Number(e.target.value))}
            className="w-24 rounded border px-3 py-2"
            min={1}
          />
          <button
            onClick={bulkGrant}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            전체 사용자에게 별 지급
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow">
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="아이디, 이메일, 닉네임 검색"
            className="flex-1 rounded-lg border px-4 py-2"
          />
          <button
            onClick={() => loadUsers(search)}
            className="rounded-lg bg-gray-800 px-4 py-2 text-white hover:bg-gray-900"
          >
            검색
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500">로딩 중...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="py-2 pr-2">아이디</th>
                  <th className="py-2 pr-2">닉네임</th>
                  <th className="py-2 pr-2">이메일</th>
                  <th className="py-2 pr-2">역할</th>
                  <th className="py-2 pr-2">별</th>
                  <th className="py-2 pr-2">플레이</th>
                  <th className="py-2">관리</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100">
                    <td className="py-2 pr-2 font-medium">{user.loginId}</td>
                    <td className="py-2 pr-2">{user.nickname ?? "-"}</td>
                    <td className="py-2 pr-2 text-xs">{user.email}</td>
                    <td className="py-2 pr-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          user.role === "ADMIN"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="py-2 pr-2">⭐ {user.currency}</td>
                    <td className="py-2 pr-2">{user._count.gameScores}회</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => updateCurrency(user.id, 5)}
                          className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800 hover:bg-yellow-200"
                        >
                          +5
                        </button>
                        <button
                          onClick={() => updateCurrency(user.id, -5)}
                          className="rounded bg-red-100 px-2 py-1 text-xs text-red-800 hover:bg-red-200"
                        >
                          -5
                        </button>
                        {user.role !== "ADMIN" && (
                          <button
                            onClick={() => toggleActive(user)}
                            className={`rounded px-2 py-1 text-xs ${
                              user.isActive
                                ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                : "bg-green-100 text-green-700 hover:bg-green-200"
                            }`}
                          >
                            {user.isActive ? "비활성" : "활성화"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
