"use client";

import { useRouter } from "next/navigation";
import { enablePwaMode } from "@/lib/pwa-mode";
import { lockPortrait, requestFullscreen } from "@/lib/fullscreen";

interface PwaExperienceButtonProps {
  href: string;
  className?: string;
  children: React.ReactNode;
}

/** 체험하기 클릭 시 PWA 모드 + 전체화면 후 이동 */
export function PwaExperienceButton({ href, className, children }: PwaExperienceButtonProps) {
  const router = useRouter();

  async function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    enablePwaMode();
    lockPortrait();
    await requestFullscreen();
    router.push(href);
  }

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
