"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { buildPwaLoginUrl } from "@/lib/pwa-mode";

interface WebExperienceSectionProps {
  compact?: boolean;
}

export function WebExperienceSection({ compact = false }: WebExperienceSectionProps) {
  const [gameUrl, setGameUrl] = useState("");

  useEffect(() => {
    setGameUrl(buildPwaLoginUrl("/home"));
  }, []);

  if (compact) {
    return (
      <div className="mx-auto mb-2 w-full max-w-[140px] text-center">
        <div className="flex h-24 w-full items-center justify-center rounded-xl border border-gray-200/80 bg-white p-1.5 shadow-sm">
          {gameUrl ? (
            <QRCodeSVG value={gameUrl} size={84} level="M" />
          ) : (
            <span className="text-[10px] text-gray-400">QR 생성 중...</span>
          )}
        </div>
        <p className="mt-1 text-[10px] font-bold text-gray-700">게임 체험</p>
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
        <div className="shrink-0 text-center">
          <div className="flex h-36 w-36 items-center justify-center rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
            {gameUrl ? (
              <QRCodeSVG value={gameUrl} size={116} level="M" />
            ) : (
              <span className="text-xs text-gray-400">QR 생성 중...</span>
            )}
          </div>
          <p className="mt-2 text-xs font-bold text-gray-800">게임 체험</p>
        </div>

        <div className="max-w-xs space-y-2 text-center sm:text-left">
          <p className="text-sm font-semibold text-gray-900">QR → 로그인 → 체험 입장</p>
          <p className="text-xs leading-relaxed text-gray-500">
            스캔 후 장비 선택 화면으로 이동합니다. 별도 설치 없이 브라우저에서 바로
            체험합니다. iPhone은 Safari{" "}
            <strong className="text-gray-700">공유 → 홈 화면에 추가</strong> 후 앱처럼
            이용할 수 있습니다.
          </p>
        </div>
      </div>
    </section>
  );
}
