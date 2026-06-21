"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { clientLogout } from "@/lib/client-logout";

interface AppHeaderProps {
  nickname?: string;
  currency?: number;
  role?: "USER" | "ADMIN";
}

export function AppHeader({ nickname, currency, role }: AppHeaderProps) {
  const { data: session } = useSession();

  const displayNickname =
    session?.user?.nickname ?? nickname ?? "플레이어";
  const displayCurrency = session?.user?.currency ?? currency ?? 0;
  const displayRole = session?.user?.role ?? role ?? "USER";

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            {displayNickname.charAt(0)}
          </div>
          <span className="truncate text-sm font-semibold text-gray-800">
            {displayNickname}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {displayRole === "ADMIN" && (
            <Link
              href="/admin"
              className="rounded-lg bg-amber-500 px-2 py-1 text-[10px] font-semibold text-white hover:bg-amber-600"
            >
              관리
            </Link>
          )}

          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            ⭐ {displayCurrency}
          </span>

          <button
            onClick={() => clientLogout()}
            className="rounded-lg bg-gray-100 px-2.5 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-200"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
