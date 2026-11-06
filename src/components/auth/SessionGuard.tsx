"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { clientLogout } from "@/lib/client-logout";

/** While the tab is visible — keep takeover nearly immediate. */
const VISIBLE_POLL_MS = 5_000;
/** Background tabs can poll more slowly. */
const HIDDEN_POLL_MS = 20_000;

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
    let timer: number | null = null;

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
          if (timer != null) {
            window.clearInterval(timer);
            timer = null;
          }
        }
      } catch {
        // Ignore transient network errors
      }
    }

    function pollIntervalMs() {
      if (typeof document === "undefined") return VISIBLE_POLL_MS;
      return document.visibilityState === "hidden"
        ? HIDDEN_POLL_MS
        : VISIBLE_POLL_MS;
    }

    function startPolling() {
      if (timer != null) window.clearInterval(timer);
      timer = window.setInterval(() => void check(), pollIntervalMs());
    }

    function onForeground() {
      void check();
      startPolling();
    }

    void check();
    startPolling();

    document.addEventListener("visibilitychange", onForeground);
    window.addEventListener("focus", onForeground);
    window.addEventListener("pageshow", onForeground);
    window.addEventListener("online", onForeground);

    return () => {
      cancelled = true;
      if (timer != null) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onForeground);
      window.removeEventListener("focus", onForeground);
      window.removeEventListener("pageshow", onForeground);
      window.removeEventListener("online", onForeground);
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
