import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { resolveAuthSecret } from "@/lib/auth-secret";
import { NextResponse } from "next/server";

const { auth } = NextAuth({
  ...authConfig,
  secret: resolveAuthSecret(),
});

const publicPaths = ["/login", "/signup", "/"];
const authPaths = ["/login", "/signup"];

function redirectWithPwa(req: { nextUrl: URL }, path: string) {
  const url = new URL(path, req.nextUrl);
  if (req.nextUrl.searchParams.get("pwa") === "1") {
    url.searchParams.set("pwa", "1");
  }
  return NextResponse.redirect(url);
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // API는 각 route에서 인증 처리 — /api/auth/session 등 JSON 응답 필요
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth;
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));
  const isAuthPage = authPaths.some((p) => pathname.startsWith(p));
  const isAdmin = pathname.startsWith("/admin");

  if (!isLoggedIn && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isAuthPage) {
    const user = req.auth?.user;
    if (!user?.nickname) {
      return redirectWithPwa(req, "/nickname");
    }
    const callback = req.nextUrl.searchParams.get("callbackUrl");
    const dest =
      callback && callback.startsWith("/") && !callback.startsWith("//")
        ? callback
        : "/home";
    return redirectWithPwa(req, dest);
  }

  if (isLoggedIn && req.auth?.user) {
    const user = req.auth.user;

    if (!user.nickname && pathname !== "/nickname") {
      return redirectWithPwa(req, "/nickname");
    }

    if (user.nickname && pathname === "/nickname") {
      return NextResponse.redirect(new URL("/home", req.url));
    }

    if (isAdmin && user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/home", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|images|games|assets|api|manifest.webmanifest).*)",
  ],
};
