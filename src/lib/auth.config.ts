import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        // ignore invalid URL
      }
      return `${baseUrl}/login`;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.loginId = user.loginId;
        token.email = user.email;
        token.nickname = user.nickname;
        token.role = user.role;
        token.currency = user.currency;
      }
      if (trigger === "update" && session?.user) {
        token.nickname = session.user.nickname ?? token.nickname;
        token.currency = session.user.currency ?? token.currency;
      }
      return token;
    },
    session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
          loginId: token.loginId as string,
          email: token.email as string,
          nickname: token.nickname as string | null,
          role: token.role as "USER" | "ADMIN",
          currency: token.currency as number,
        },
      };
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;
      const publicPaths = ["/login", "/signup"];
      const isPublic = publicPaths.some((p) => pathname.startsWith(p));

      if (pathname.startsWith("/api")) return true;
      if (!isLoggedIn && !isPublic && pathname !== "/") return false;

      if (isLoggedIn && auth?.user) {
        if (pathname.startsWith("/admin") && auth.user.role !== "ADMIN") {
          return false;
        }
      }

      return true;
    },
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },
} satisfies NextAuthConfig;
