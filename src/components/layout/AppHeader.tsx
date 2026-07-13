"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { clientLogout } from "@/lib/client-logout";
import { MailboxModal, useMailboxBadge } from "@/components/layout/MailboxModal";
import {
  InventoryModal,
  useCouponBadge,
  type InventoryCoupon,
} from "@/components/layout/InventoryModal";
import { SettingsModal } from "@/components/layout/SettingsModal";
import { RankingBoard } from "@/components/games/RankingBoard";
import { AppSideMenu } from "@/components/layout/AppSideMenu";

interface AppHeaderProps {
  nickname?: string;
  currency?: number;
  role?: "USER" | "ADMIN";
}

function formatBadgeCount(count: number) {
  return count > 9 ? "9+" : String(count);
}

function HamburgerButton({
  onClick,
  open,
  badgeCount,
}: {
  onClick: () => void;
  open: boolean;
  badgeCount: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white shadow-sm hover:bg-slate-50"
      aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
      aria-expanded={open}
    >
      <span className="flex w-4 flex-col items-center justify-center gap-1">
        <span
          className={`block h-0.5 w-4 rounded-full bg-gray-700 transition-transform duration-300 ${
            open ? "translate-y-1.5 rotate-45" : ""
          }`}
        />
        <span
          className={`block h-0.5 w-4 rounded-full bg-gray-700 transition-opacity duration-300 ${
            open ? "opacity-0" : ""
          }`}
        />
        <span
          className={`block h-0.5 w-4 rounded-full bg-gray-700 transition-transform duration-300 ${
            open ? "-translate-y-1.5 -rotate-45" : ""
          }`}
        />
      </span>
      {badgeCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white shadow-sm">
          {formatBadgeCount(badgeCount)}
        </span>
      ) : null}
    </button>
  );
}

export function AppHeader({ nickname, currency, role }: AppHeaderProps) {
  const { data: session, status, update } = useSession();
  const [liveCurrency, setLiveCurrency] = useState<number | null>(null);
  const seenSessionCurrencyRef = useRef<number | undefined>(undefined);
  const syncedServerCurrencyRef = useRef<number | null>(null);
  const { notifyCount: mailNotifyCount, refresh: refreshMailbox } =
    useMailboxBadge();
  const {
    notifyCount: couponNotifyCount,
    refresh: refreshCoupons,
    markSeen: markCouponsSeen,
  } = useCouponBadge();
  const [menuOpen, setMenuOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [mailboxOpen, setMailboxOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);

  const sessionCurrency = session?.user?.currency;
  const menuNotifyCount = mailNotifyCount + couponNotifyCount;

  const handleInventoryChange = useCallback(
    (coupons: InventoryCoupon[]) => {
      markCouponsSeen(coupons);
    },
    [markCouponsSeen],
  );

  // 페이지 SSR(DB) 값이 있으면 JWT보다 우선해 첫 페인트 오표시를 막는다.
  useEffect(() => {
    setLiveCurrency(null);
    syncedServerCurrencyRef.current = null;
  }, [currency]);

  // 서버에서 내려준 최신 재화로 JWT를 맞춘다.
  useEffect(() => {
    if (status !== "authenticated") return;
    if (typeof currency !== "number") return;
    if (sessionCurrency === currency) return;
    if (syncedServerCurrencyRef.current === currency) return;
    syncedServerCurrencyRef.current = currency;
    void update({ user: { currency } });
  }, [currency, sessionCurrency, status, update]);

  // 우편 수령·게임 보상 등 페이지 내 세션 갱신만 반영한다.
  // 첫 하이드레이션 값은 SSR이 있을 때 무시해 잠깐 0/구값으로 깜빡이지 않게 한다.
  useEffect(() => {
    if (typeof sessionCurrency !== "number") return;
    const prev = seenSessionCurrencyRef.current;
    seenSessionCurrencyRef.current = sessionCurrency;
    if (prev === undefined) {
      if (typeof currency !== "number") {
        setLiveCurrency(sessionCurrency);
      }
      return;
    }
    if (prev !== sessionCurrency) {
      setLiveCurrency(sessionCurrency);
    }
  }, [currency, sessionCurrency]);

  const displayNickname =
    session?.user?.nickname ?? nickname ?? "플레이어";
  const displayCurrency = liveCurrency ?? currency ?? sessionCurrency ?? 0;
  const displayRole = session?.user?.role ?? role ?? "USER";

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/90 shadow-[0_1px_12px_rgba(15,23,42,0.06)] backdrop-blur-md">
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
            <span className="rounded-full border border-amber-200/80 bg-gradient-to-b from-amber-50 to-amber-100/90 px-2.5 py-1 text-xs font-bold text-amber-800 shadow-sm">
              ⭐ {displayCurrency.toLocaleString()}
            </span>

            <HamburgerButton
              open={menuOpen}
              badgeCount={menuNotifyCount}
              onClick={() => setMenuOpen((prev) => !prev)}
            />
          </div>
        </div>
      </header>

      <AppSideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        nickname={displayNickname}
        mailNotifyCount={mailNotifyCount}
        couponNotifyCount={couponNotifyCount}
        isAdmin={displayRole === "ADMIN"}
        onOpenMailbox={() => setMailboxOpen(true)}
        onOpenInventory={() => setInventoryOpen(true)}
        onOpenRanking={() => setRankingOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onLogout={() => clientLogout()}
      />

      <MailboxModal
        open={mailboxOpen}
        onClose={() => setMailboxOpen(false)}
        onMailboxChange={() => {
          void refreshMailbox();
          void refreshCoupons();
        }}
      />
      <InventoryModal
        open={inventoryOpen}
        onClose={() => setInventoryOpen(false)}
        onInventoryChange={handleInventoryChange}
      />
      <RankingBoard
        gameId="yanmar"
        open={rankingOpen}
        onClose={() => setRankingOpen(false)}
        highlightNickname={displayNickname}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
