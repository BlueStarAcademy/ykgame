"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { buildPwaLoginUrl } from "@/lib/pwa-mode";

interface WebExperienceSectionProps {
  compact?: boolean;
}

export function WebExperienceSection({ compact = false }: WebExperienceSectionProps) {
  const [loginUrl, setLoginUrl] = useState("");

  useEffect(() => {
    setLoginUrl(buildPwaLoginUrl("/home"));
  }, []);

  if (compact) {
    return (
      <div className="mx-auto mb-2 flex justify-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-gray-200/80 bg-white p-1.5 shadow-sm">
          {loginUrl ? (
            <QRCodeSVG value={loginUrl} size={88} level="M" />
          ) : (
            <span className="text-[10px] text-gray-400">QR 생성 중...</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="landing-qr-card overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50 px-5 py-4">
        <h2 className="text-base font-bold text-gray-900">모바일 QR 체험</h2>
        <p className="mt-1 text-xs text-gray-500">
          스마트폰으로 스캔하면 로그인 화면이 열립니다
        </p>
      </div>

      <div className="flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-center sm:justify-center">
        <div className="flex h-48 w-48 shrink-0 items-center justify-center rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          {loginUrl ? (
            <QRCodeSVG value={loginUrl} size={160} level="M" />
          ) : (
            <span className="text-xs text-gray-400">QR 생성 중...</span>
          )}
        </div>

        <div className="max-w-xs space-y-2 text-center sm:text-left">
          <p className="text-sm font-semibold text-gray-900">📱 QR → 로그인 → 장비 선택</p>
          <p className="text-xs leading-relaxed text-gray-500">
            별도 설치 없이 브라우저에서 바로 체험합니다. iPhone은 Safari{" "}
            <strong className="text-gray-700">공유 → 홈 화면에 추가</strong> 후 앱처럼
            이용할 수 있습니다.
          </p>
        </div>
      </div>
    </section>
  );
}
