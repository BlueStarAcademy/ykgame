"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { PwaModeRoot } from "@/components/pwa/PwaModeRoot";
import { SessionGuard } from "@/components/auth/SessionGuard";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath="/api/auth">
      <SessionGuard>
        <Suspense>
          <PwaModeRoot>{children}</PwaModeRoot>
        </Suspense>
      </SessionGuard>
    </SessionProvider>
  );
}
