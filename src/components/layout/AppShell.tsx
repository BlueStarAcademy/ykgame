import { AppHeader } from "./AppHeader";
import { AppFooter } from "./AppFooter";

interface AppShellProps {
  children: React.ReactNode;
  nickname?: string;
  currency?: number;
  role?: "USER" | "ADMIN";
  /** 로비처럼 하단 모드 버튼이 화면 끝을 쓰는 경우 저작권 푸터를 숨김 */
  hideFooter?: boolean;
}

export function AppShell({
  children,
  nickname,
  currency,
  role,
  hideFooter = false,
}: AppShellProps) {
  return (
    <div className="app-shell flex min-h-dvh flex-col bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,#e8eef5_0%,#f1f5f9_45%,#eef2f7_100%)]">
      <AppHeader nickname={nickname} currency={currency} role={role} />
      <main
        className={`app-shell-main mx-auto flex h-0 min-h-0 w-full max-w-lg flex-1 flex-col overflow-hidden px-4 pt-[4.5rem] ${
          hideFooter ? "pb-2" : "pb-16"
        }`}
      >
        {children}
      </main>
      {hideFooter ? null : <AppFooter />}
    </div>
  );
}
