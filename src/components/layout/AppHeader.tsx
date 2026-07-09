"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { clientLogout } from "@/lib/client-logout";
import { MailboxModal, useMailboxBadge } from "@/components/layout/MailboxModal";
import { InventoryModal } from "@/components/layout/InventoryModal";
import { SettingsModal } from "@/components/layout/SettingsModal";
import { RankingBoard } from "@/components/games/RankingBoard";
import { AppSideMenu } from "@/components/layout/AppSideMenu";

interface AppHeaderProps {
  nickname?: string;
  currency?: number;
  role?: "USER" | "ADMIN";
}

function HamburgerButton({ onClick, open }: { onClick: () => void; open: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white shadow-sm hover:bg-slate-50"
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
    </button>
  );
}

export function AppHeader({ nickname, currency, role }: AppHeaderProps) {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [mailboxOpen, setMailboxOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);
  const { unclaimedCount, refresh: refreshMailbox } = useMailboxBadge();

  const displayNickname =
    session?.user?.nickname ?? nickname ?? "플레이어";
  const displayCurrency = session?.user?.currency ?? currency ?? 0;
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
              onClick={() => setMenuOpen((prev) => !prev)}
            />
          </div>
        </div>
      </header>

      <AppSideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        nickname={displayNickname}
        unclaimedMailCount={unclaimedCount}
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
        onMailboxChange={refreshMailbox}
      />
      <InventoryModal open={inventoryOpen} onClose={() => setInventoryOpen(false)} />
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
