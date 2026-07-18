"use client";

import { useEffect } from "react";
import { siteLegendLoginBgm } from "@/components/auth/siteLegendLoginBgm";

/**
 * Allows login/title BGM while the hosting screen is mounted and `allowed`.
 * Actual on/off + volume come from the shared sound settings store.
 */
export function useSiteLegendLoginBgm(allowed = true) {
  useEffect(() => {
    siteLegendLoginBgm.start();
    siteLegendLoginBgm.setAllowed(allowed);
    return () => {
      siteLegendLoginBgm.setAllowed(false);
    };
  }, [allowed]);
}
