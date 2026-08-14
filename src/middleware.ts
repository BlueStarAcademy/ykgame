import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { resolveAuthSecret } from "@/lib/auth-secret";
import { NextResponse } from "next/server";
import {
  defaultLocale,
  LOCALE_COOKIE,
  parseLocale,
} from "@/i18n/config";

const { auth } = NextAuth({
  ...authConfig,
  secret: resolveAuthSecret(),
});

const publicPaths = ["/login", "/signup", "/", "/home"];
const authPaths = ["/login", "/signup"];

function redirectWithPwa(req: { nextUrl: URL }, path: string) {
  const url = new URL(path, req.nextUrl);
  if (req.nextUrl.searchParams.get("pwa") === "1") {
    url.searchParams.set("pwa", "1");
  }
  return NextResponse.redirect(url);
}

function withLocaleCookie(
  req: { cookies: { get: (name: string) => { value: string } | undefined } },
  res: NextResponse,
) {
  if (!req.cookies.get(LOCALE_COOKIE)?.value) {
    res.cookies.set(LOCALE_COOKIE, defaultLocale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  } else {
    // Normalize invalid values
    const current = req.cookies.get(LOCALE_COOKIE)?.value;
    const locale = parseLocale(current);
    if (current !== locale) {
      res.cookies.set(LOCALE_COOKIE, locale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
  }
  return res;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // API는 각 route에서 인증 처리 — /api/auth/session 등 JSON 응답 필요
  if (pathname.startsWith("/api/")) {
    return withLocaleCookie(req, NextResponse.next());
  }

  const isLoggedIn = !!req.auth;
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));
  const isAuthPage = authPaths.some((p) => pathname.startsWith(p));
  const isAdmin = pathname.startsWith("/admin");

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", req.url);
    if (req.nextUrl.searchParams.get("pwa") === "1") {
      loginUrl.searchParams.set("pwa", "1");
    }
    const callbackPath = `${req.nextUrl.pathname}${req.nextUrl.search}`;
    if (callbackPath.startsWith("/") && !callbackPath.startsWith("//")) {
      loginUrl.searchParams.set("callbackUrl", callbackPath);
    }
    return withLocaleCookie(req, NextResponse.redirect(loginUrl));
  }

  if (isLoggedIn && isAuthPage) {
    const user = req.auth?.user;
    if (!user?.nickname) {
      return withLocaleCookie(req, redirectWithPwa(req, "/nickname"));
    }
    const callback = req.nextUrl.searchParams.get("callbackUrl");
    const dest =
      callback && callback.startsWith("/") && !callback.startsWith("//")
        ? callback
        : "/home";
    return withLocaleCookie(req, redirectWithPwa(req, dest));
  }

  if (isLoggedIn && req.auth?.user) {
    const user = req.auth.user;

    if (!user.nickname && pathname !== "/nickname") {
      return withLocaleCookie(req, redirectWithPwa(req, "/nickname"));
    }

    if (user.nickname && pathname === "/nickname") {
      return withLocaleCookie(
        req,
        NextResponse.redirect(new URL("/home", req.url)),
      );
    }

    if (isAdmin && user.role !== "ADMIN") {
      return withLocaleCookie(
        req,
        NextResponse.redirect(new URL("/home", req.url)),
      );
    }
  }

  return withLocaleCookie(req, NextResponse.next());
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|images|games|assets|api|manifest.webmanifest).*)",
  ],
};
