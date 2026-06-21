import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const publicPaths = ["/login", "/signup"];
const authPaths = ["/login", "/signup"];

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

  if (!isLoggedIn && !isPublic && pathname !== "/") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isAuthPage) {
    const user = req.auth?.user;
    if (!user?.nickname) {
      return NextResponse.redirect(new URL("/nickname", req.url));
    }
    return NextResponse.redirect(new URL("/home", req.url));
  }

  if (isLoggedIn && req.auth?.user) {
    const user = req.auth.user;

    if (!user.nickname && pathname !== "/nickname") {
      return NextResponse.redirect(new URL("/nickname", req.url));
    }

    if (user.nickname && pathname === "/nickname") {
      return NextResponse.redirect(new URL("/home", req.url));
    }

    if (isAdmin && user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/home", req.url));
    }
  }

  if (pathname === "/") {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/login", req.url));
    const user = req.auth?.user;
    if (!user?.nickname) {
      return NextResponse.redirect(new URL("/nickname", req.url));
    }
    return NextResponse.redirect(new URL("/home", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets).*)"],
};
