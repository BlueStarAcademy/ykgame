"use client";

import Link from "next/link";
import { useEffect } from "react";
import { createPortal } from "react-dom";

interface AppSideMenuProps {
  open: boolean;
  onClose: () => void;
  nickname: string;
  mailNotifyCount: number;
  couponNotifyCount: number;
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
  const className = `flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors ${
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
  mailNotifyCount,
  couponNotifyCount,
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

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  function handleMenuAction(action: () => void) {
    onClose();
    action();
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/55 p-4"
      onClick={onClose}
    >
      <div
        className="w-[min(100%,18rem)] overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="메뉴"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
              {nickname.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900">{nickname}</p>
              <p className="text-[11px] text-gray-400">메뉴</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600 hover:bg-gray-200"
            aria-label="메뉴 닫기"
          >
            닫기
          </button>
        </div>

        <nav className="space-y-0.5 p-2">
          <MenuItem
            icon="📬"
            label="우편함"
            badge={mailNotifyCount}
            onClick={() => handleMenuAction(onOpenMailbox)}
          />
          <MenuItem
            icon="🎟️"
            label="쿠폰함"
            badge={couponNotifyCount}
            onClick={() => handleMenuAction(onOpenInventory)}
          />
          <MenuItem
            icon="📊"
            label="랭킹정보"
            onClick={() => handleMenuAction(onOpenRanking)}
          />
          <MenuItem
            icon="⚙️"
            label="설정"
            onClick={() => handleMenuAction(onOpenSettings)}
          />
          {isAdmin ? (
            <MenuItem icon="🛠️" label="관리" href="/admin" onClick={onClose} />
          ) : null}
        </nav>

        <div className="border-t border-gray-100 p-2">
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
      </div>
    </div>,
    document.body,
  );
}
