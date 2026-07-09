"use client";

import Link from "next/link";
import { useEffect } from "react";

interface AppSideMenuProps {
  open: boolean;
  onClose: () => void;
  nickname: string;
  unclaimedMailCount: number;
  isAdmin?: boolean;
  onOpenMailbox: () => void;
  onOpenInventory: () => void;
  onOpenRanking: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

interface MenuItemProps {
  icon: string;
  label: string;
  badge?: number;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}

function MenuItem({ icon, label, badge, onClick, href, danger }: MenuItemProps) {
  const className = `flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
    danger
      ? "text-red-600 hover:bg-red-50"
      : "text-gray-800 hover:bg-gray-50"
  }`;

  const content = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg">
        {icon}
      </span>
      <span className="flex-1 text-sm font-semibold">{label}</span>
      {badge && badge > 0 ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

export function AppSideMenu({
  open,
  onClose,
  nickname,
  unclaimedMailCount,
  isAdmin,
  onOpenMailbox,
  onOpenInventory,
  onOpenRanking,
  onOpenSettings,
  onLogout,
}: AppSideMenuProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  function handleMenuAction(action: () => void) {
    onClose();
    action();
  }

  return (
    <div
      className={`fixed inset-0 z-[300] transition-opacity duration-300 ${
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="메뉴 닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />

      <aside
        className={`absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="메뉴"
      >
        <div className="border-b border-gray-100 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
              {nickname.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-gray-900">{nickname}</p>
              <p className="text-xs text-gray-400">메뉴</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <MenuItem
            icon="📬"
            label="우편함"
            badge={unclaimedMailCount}
            onClick={() => handleMenuAction(onOpenMailbox)}
          />
          <MenuItem
            icon="🎟️"
            label="쿠폰함"
            onClick={() => handleMenuAction(onOpenInventory)}
          />
          <MenuItem
            icon="📊"
            label="랭킹보기"
            onClick={() => handleMenuAction(onOpenRanking)}
          />
          <MenuItem
            icon="⚙️"
            label="설정"
            onClick={() => handleMenuAction(onOpenSettings)}
          />
          {isAdmin ? (
            <MenuItem
              icon="🛠️"
              label="관리"
              href="/admin"
              onClick={onClose}
            />
          ) : null}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <MenuItem
            icon="🚪"
            label="로그아웃"
            danger
            onClick={() => {
              onClose();
              onLogout();
            }}
          />
        </div>
      </aside>
    </div>
  );
}
