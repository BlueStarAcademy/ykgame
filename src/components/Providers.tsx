"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { PwaModeRoot } from "@/components/pwa/PwaModeRoot";
import { SessionGuard } from "@/components/auth/SessionGuard";
import { UiClickFeedback } from "@/components/UiClickFeedback";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath="/api/auth">
      <SessionGuard>
        <UiClickFeedback />
        <Suspense>
          <PwaModeRoot>{children}</PwaModeRoot>
        </Suspense>
      </SessionGuard>
    </SessionProvider>
  );
}
