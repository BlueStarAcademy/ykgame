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
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <AppHeader nickname={nickname} currency={currency} role={role} />
      <main
        className={`mx-auto max-w-lg px-4 pt-[4.5rem] ${
          showHomeFeatures ? "pb-36" : "pb-16"
        }`}
      >
        {children}
      </main>
      <AppFooter showFeatures={showHomeFeatures} />
    </div>
  );
}
