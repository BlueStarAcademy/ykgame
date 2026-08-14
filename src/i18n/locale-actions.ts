"use server";

import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LOCALE_COOKIE, parseLocale, type Locale } from "./config";

export async function setUserLocale(nextLocale: string): Promise<{ locale: Locale }> {
  const locale = parseLocale(nextLocale);
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const session = await auth();
  if (session?.user?.id) {
    try {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { locale },
      });
    } catch (error) {
      console.error("[locale] failed to persist User.locale:", error);
    }
  }

  return { locale };
}
