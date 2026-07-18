"use client";

import { signOut } from "next-auth/react";

async function clearLogoutPresence() {
  try {
    await fetch("/api/auth/logout-presence", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Best-effort presence clear
  }
}

/** 배포 환경에서도 안전하게 동작하는 로그아웃 */
export async function clientLogout(options?: {
  /** Skip presence clear (e.g. already kicked by another device). */
  skipPresenceClear?: boolean;
}) {
  if (!options?.skipPresenceClear) {
    await clearLogoutPresence();
  }
  try {
    await signOut({ redirectTo: "/login", redirect: false });
  } catch {
    // signOut API 실패 시에도 로그인 페이지로 이동
  }
  window.location.assign("/login");
}
