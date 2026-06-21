import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";
import { ensureAuthSecretEnv, resolveAuthSecret } from "./auth-secret";
import type { Role } from "@/generated/prisma/client";

ensureAuthSecretEnv();

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      loginId: string;
      email: string;
      nickname: string | null;
      role: Role;
      currency: number;
    };
  }

  interface User {
    id: string;
    loginId: string;
    email: string;
    nickname: string | null;
    role: Role;
    currency: number;
  }

  interface JWT {
    id: string;
    loginId: string;
    email: string;
    nickname: string | null;
    role: Role;
    currency: number;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  secret: resolveAuthSecret(),
  providers: [
    Credentials({
      credentials: {
        loginId: { label: "아이디", type: "text" },
        password: { label: "비밀번호", type: "password" },
        rememberMe: { label: "자동 로그인", type: "text" },
      },
      authorize: async (credentials) => {
        const loginId = credentials?.loginId as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!loginId || !password) return null;

        const user = await prisma.user.findUnique({ where: { loginId } });
        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          loginId: user.loginId,
          email: user.email,
          nickname: user.nickname,
          role: user.role,
          currency: user.currency,
        };
      },
    }),
  ],
});

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
