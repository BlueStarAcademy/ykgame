"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LOCALE_COOKIE, parseLocale, type Locale } from "@/i18n/config";
import { setUserLocale } from "@/i18n/locale-actions";

function readCookieLocale(): Locale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${LOCALE_COOKIE}=`));
  if (!match) return null;
  return parseLocale(decodeURIComponent(match.split("=")[1] ?? ""));
}

/**
 * When a logged-in user has User.locale, sync NEXT_LOCALE cookie once.
 */
export function LocaleSync() {
  const { data: session, status } = useSession();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const syncedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (syncedForUser.current === session.user.id) return;
    let cancelled = false;

    fetch("/api/user/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then(async (data) => {
        if (cancelled || !data?.user?.locale) {
          syncedForUser.current = session.user.id;
          return;
        }
        const preferred = parseLocale(data.user.locale);
        const cookieLocale = readCookieLocale();
        syncedForUser.current = session.user.id;
        if (preferred !== locale || preferred !== cookieLocale) {
          await setUserLocale(preferred);
          router.refresh();
        }
      })
      .catch(() => {
        syncedForUser.current = session.user.id;
      });

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id, locale, router]);

  return null;
}
