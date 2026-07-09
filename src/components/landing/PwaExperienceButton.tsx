"use client";

import { useRouter } from "next/navigation";
import { setExperienceMode, type ExperienceMode } from "@/lib/experience-mode";
import { enablePwaMode } from "@/lib/pwa-mode";

interface PwaExperienceButtonProps {
  href: string;
  experienceMode?: ExperienceMode;
  className?: string;
  children: React.ReactNode;
}

/** 체험 CTA — PWA 모드 + 체험 유형 저장 후 이동 */
export function PwaExperienceButton({
  href,
  experienceMode,
  className,
  children,
}: PwaExperienceButtonProps) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    enablePwaMode();
    if (experienceMode) setExperienceMode(experienceMode);
    router.push(href);
  }

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
