"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { PwaModeRoot } from "@/components/pwa/PwaModeRoot";
import { MobilePortraitRoot } from "@/components/pwa/MobilePortraitRoot";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath="/api/auth">
      <MobilePortraitRoot>
        <Suspense>
          <PwaModeRoot>{children}</PwaModeRoot>
        </Suspense>
      </MobilePortraitRoot>
    </SessionProvider>
  );
}
