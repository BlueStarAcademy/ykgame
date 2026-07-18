import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";
import { ensureAuthSecretEnv, resolveAuthSecret } from "./auth-secret";
import { bumpSessionVersion, assertSessionCurrent } from "./session-guard";
import type { Role } from "@/generated/prisma/client";

ensureAuthSecretEnv();

function logAuthFailure(reason: string, loginId?: string) {
  console.warn(`[auth] sign-in failed: ${reason}${loginId ? ` (loginId=${loginId})` : ""}`);
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      loginId: string;
      email: string;
      nickname: string | null;
      profileAvatarId: string | null;
      role: Role;
      currency: number;
      totalXp: number;
      sessionVersion: number;
    };
  }

  interface User {
    id: string;
    loginId: string;
    email: string;
    nickname: string | null;
    profileAvatarId: string | null;
    role: Role;
    currency: number;
    totalXp: number;
    sessionVersion: number;
  }

  interface JWT {
    id: string;
    loginId: string;
    email: string;
    nickname: string | null;
    profileAvatarId: string | null;
    role: Role;
    currency: number;
    totalXp: number;
    sessionVersion: number;
  }
}

const {
  handlers,
  signIn,
  signOut,
  auth: rawAuth,
} = NextAuth({
  ...authConfig,
  secret: resolveAuthSecret(),
  providers: [
    Credentials({
      credentials: {
        loginId: { label: "아이디", type: "text" },
        password: { label: "비밀번호", type: "password" },
        rememberMe: { label: "자동 로그인", type: "text" },
        forceTakeover: { label: "강제 접속", type: "text" },
      },
      authorize: async (credentials) => {
        console.warn("[auth] authorize called");

        const loginId = (credentials?.loginId as string | undefined)?.trim();
        const password = credentials?.password as string | undefined;

        if (!loginId || !password) {
          logAuthFailure("missing credentials");
          return null;
        }

        let user;
        try {
          user = await prisma.user.findUnique({ where: { loginId } });
        } catch (error) {
          console.error("[auth] database lookup failed:", error);
          return null;
        }

        if (!user) {
          logAuthFailure("user not found", loginId);
          return null;
        }
        if (!user.isActive) {
          logAuthFailure("user inactive", loginId);
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          logAuthFailure("invalid password", loginId);
          return null;
        }

        let sessionVersion: number;
        try {
          sessionVersion = await bumpSessionVersion(user.id);
        } catch (error) {
          console.error("[auth] session version bump failed:", error);
          return null;
        }

        console.warn(`[auth] sign-in ok: ${loginId} (sessionVersion=${sessionVersion})`);

        return {
          id: user.id,
          name: user.nickname ?? user.loginId,
          loginId: user.loginId,
          email: user.email,
          nickname: user.nickname,
          profileAvatarId: user.profileAvatarId,
          role: user.role,
          currency: user.currency,
          totalXp: user.totalXp,
          sessionVersion,
        };
      },
    }),
  ],
});

export { handlers, signIn, signOut };

/** Raw JWT session (no single-session DB check). */
export const getTokenSession = rawAuth;

/**
 * Session with single-session enforcement.
 * Superseded JWTs resolve to null so API routes reject them.
 */
export async function auth() {
  const session = await rawAuth();
  if (!session?.user?.id) return session;

  const version = session.user.sessionVersion;
  if (typeof version !== "number") return null;

  try {
    await assertSessionCurrent(session.user.id, version);
  } catch {
    return null;
  }

  return session;
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return session;
}
