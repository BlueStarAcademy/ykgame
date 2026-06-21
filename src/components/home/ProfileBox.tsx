"use client";

import { clientLogout } from "@/lib/client-logout";

interface ProfileBoxProps {
  nickname: string;
  currency: number;
  totalStars: number;
}

export function ProfileBox({ nickname, currency, totalStars }: ProfileBoxProps) {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-lg font-bold">
            {nickname.charAt(0)}
          </div>
          <div>
            <p className="text-sm text-blue-100">플레이어</p>
            <p className="text-lg font-bold">{nickname}</p>
          </div>
        </div>
        <button
          onClick={() => clientLogout()}
          className="rounded-lg bg-white/20 px-3 py-1.5 text-sm hover:bg-white/30"
        >
          로그아웃
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/15 p-3 text-center">
          <p className="text-xs text-blue-100">보유 별 (재화)</p>
          <p className="text-2xl font-bold">⭐ {currency}</p>
        </div>
        <div className="rounded-xl bg-white/15 p-3 text-center">
          <p className="text-xs text-blue-100">획득 별 합계</p>
          <p className="text-2xl font-bold">★ {totalStars}</p>
        </div>
      </div>
    </div>
  );
}
