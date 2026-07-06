"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { PwaModeRoot } from "@/components/pwa/PwaModeRoot";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath="/api/auth">
      <Suspense>
        <PwaModeRoot>{children}</PwaModeRoot>
      </Suspense>
    </SessionProvider>
  );
}
