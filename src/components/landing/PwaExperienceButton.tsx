"use client";

import { useRouter } from "next/navigation";
import { enablePwaMode } from "@/lib/pwa-mode";

interface PwaExperienceButtonProps {
  href: string;
  className?: string;
  children: React.ReactNode;
}

/** 체험하기 클릭 시 PWA 모드로 전환 후 이동 */
export function PwaExperienceButton({ href, className, children }: PwaExperienceButtonProps) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    enablePwaMode();
    router.push(href);
  }

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
