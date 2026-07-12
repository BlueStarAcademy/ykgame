"use client";

import Link from "next/link";
import { AdminShell } from "./AdminShell";

const MENU_ITEMS = [
  {
    href: "/admin/users",
    emoji: "👥",
    title: "회원관리",
    desc: "회원 목록 조회 및 상세 관리",
    color: "border-blue-200 bg-gradient-to-br from-blue-50 to-white",
  },
  {
    href: "/admin/coupons",
    emoji: "🎟️",
    title: "쿠폰 관리",
    desc: "시즌별 쿠폰 잔여 수량 및 획득 내역",
    color: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white",
  },
  {
    href: "/admin/probability",
    emoji: "🎲",
    title: "확률정보",
    desc: "게임 보상·쿠폰·강화·덤프트럭 확률 확인",
    color: "border-violet-200 bg-gradient-to-br from-violet-50 to-white",
  },
  {
    href: "/admin/quests",
    emoji: "📋",
    title: "퀘스트 정보",
    desc: "일일·미션 퀘스트 규칙·보상·과제 풀",
    color: "border-cyan-200 bg-gradient-to-br from-cyan-50 to-white",
  },
  {
    href: "/admin/workshops",
    emoji: "🏗️",
    title: "작업장 정보",
    desc: "굴착·하역·Crash·Hill 작업장별 운영 및 활동 현황",
    color: "border-orange-200 bg-gradient-to-br from-orange-50 to-white",
  },
  {
    href: "/admin/mail",
    emoji: "📮",
    title: "우편발송",
    desc: "재화 지급 및 우편 발송",
    color: "border-amber-200 bg-gradient-to-br from-amber-50 to-white",
  },
  {
    href: "/admin/notices",
    emoji: "📢",
    title: "전광판 공지",
    desc: "게임 상단 전광판 공지 작성·순서·표시 관리",
    color: "border-rose-200 bg-gradient-to-br from-rose-50 to-white",
  },
];

export function AdminHome() {
  return (
    <AdminShell
      title="관리자 패널"
      subtitle="관리 메뉴를 선택하세요."
      backHref="/home"
      backLabel="홈으로"
    >
      <div className="grid gap-3">
        {MENU_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-4 rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${item.color}`}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
              {item.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-black text-slate-900">{item.title}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{item.desc}</span>
            </span>
            <span className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
              입장
            </span>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
