"use client";

import { signOut } from "next-auth/react";

/** 배포 환경에서도 안전하게 동작하는 로그아웃 */
export async function clientLogout() {
  try {
    await signOut({ redirectTo: "/login", redirect: false });
  } catch {
    // signOut API 실패 시에도 로그인 페이지로 이동
  }
  window.location.assign("/login");
}
