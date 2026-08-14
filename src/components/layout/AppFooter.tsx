"use client";

import { useTranslations } from "next-intl";

export function AppFooter() {
  const t = useTranslations("landing");

  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
      <div className="mx-auto flex h-9 max-w-lg items-center justify-center px-4">
        <p className="text-[10px] text-gray-400">
          {t("footer")}
        </p>
      </div>
    </footer>
  );
}
