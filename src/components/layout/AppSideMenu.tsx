"use client";

import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

interface AppSideMenuProps {
  open: boolean;
  onClose: () => void;
  /** 메뉴 버튼 — 패널을 이 버튼 아래·우측에 붙인다 */
  anchorRef?: RefObject<HTMLElement | null>;
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
  anchorRef,
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
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }

    const updatePos = () => {
      const rect = anchorRef?.current?.getBoundingClientRect();
      if (!rect) {
        setPanelPos({ top: 56, right: 12 });
        return;
      }
      setPanelPos({
        top: rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };

    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  function handleMenuAction(action: () => void) {
    onClose();
    action();
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* 뒤쪽이 보이도록 딤 없이 클릭만 흡수 */}
      <button
        type="button"
        className="fixed inset-0 z-[300] cursor-default bg-transparent"
        aria-label="메뉴 닫기"
        onClick={onClose}
      />
      <div
        className="fixed z-[310] w-[min(100%,17.5rem)] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-2xl backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-label="메뉴"
        style={
          panelPos
            ? { top: panelPos.top, right: panelPos.right }
            : { top: 56, right: 12 }
        }
      >
        <div className="flex items-center gap-3 border-b border-gray-100 px-3.5 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
            {nickname.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">{nickname}</p>
            <p className="text-[11px] text-gray-400">메뉴</p>
          </div>
        </div>

        <nav className="space-y-0.5 p-1.5">
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

        <div className="border-t border-gray-100 p-1.5">
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
    </>,
    document.body,
  );
}
