import { AppHeader } from "./AppHeader";
import { AppFooter } from "./AppFooter";

interface AppShellProps {
  children: React.ReactNode;
  nickname?: string;
  currency?: number;
  role?: "USER" | "ADMIN";
  showHomeFeatures?: boolean;
}

export function AppShell({
  children,
  nickname,
  currency,
  role,
  showHomeFeatures = false,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,#e8eef5_0%,#f1f5f9_45%,#eef2f7_100%)]">
      <AppHeader nickname={nickname} currency={currency} role={role} />
      <main
        className={`mx-auto max-w-lg px-4 pt-[4.5rem] ${
          showHomeFeatures
            ? "flex h-dvh flex-col overflow-hidden pb-[9rem]"
            : "pb-16"
        }`}
      >
        {children}
      </main>
      <AppFooter showFeatures={showHomeFeatures} />
    </div>
  );
}
