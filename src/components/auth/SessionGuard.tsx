"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { clientLogout } from "@/lib/client-logout";

const POLL_INTERVAL_MS = 15_000;

/**
 * Polls session status while authenticated. If another device takes over,
 * shows a notice and logs out.
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [kicked, setKicked] = useState(false);
  const kickedRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || kickedRef.current) return;

    let cancelled = false;

    async function check() {
      if (cancelled || kickedRef.current) return;
      try {
        const res = await fetch("/api/auth/session-status", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok || cancelled || kickedRef.current) return;
        const data = (await res.json()) as { status?: string };
        if (data.status === "superseded") {
          kickedRef.current = true;
          setKicked(true);
        }
      } catch {
        // Ignore transient network errors
      }
    }

    void check();
    const timer = window.setInterval(() => void check(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [status]);

  async function handleConfirmKick() {
    await clientLogout({ skipPresenceClear: true });
  }

  return (
    <>
      {children}
      <AppModalOverlay open={kicked} nested>
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="px-5 py-6 text-center">
            <p className="text-base font-semibold text-gray-900">
              다른 기기에서 로그인 되었습니다.
            </p>
            <button
              type="button"
              onClick={() => void handleConfirmKick()}
              className="mt-5 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              확인
            </button>
          </div>
        </div>
      </AppModalOverlay>
    </>
  );
}
