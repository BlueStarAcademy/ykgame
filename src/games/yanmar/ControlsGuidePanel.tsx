"use client";

import { YANMAR_ASSETS } from "./controls";
import type { DigFeedback } from "./bucket";
import { DigHintContent } from "./DigHintPanel";

interface ControlsGuidePanelProps {
  open: boolean;
  onClose: () => void;
  digFeedback: DigFeedback;
  bucketLoad: number;
  maxLoadUnits: number;
  boom: number;
}

export function ControlsGuidePanel({
  open,
  onClose,
  digFeedback,
  bucketLoad,
  maxLoadUnits,
  boom,
}: ControlsGuidePanelProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[500] flex flex-col bg-black/85 backdrop-blur-sm"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      role="dialog"
      aria-modal
      aria-label="얀마 SV08-1 조작 기능 안내"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <div>
          <p className="text-[10px] font-medium text-red-300">YANMAR SV08-1</p>
          <h2 className="text-sm font-bold text-white">부품별 조작 기능</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
        >
          닫기
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={YANMAR_ASSETS.controlsGuide}
          alt="얀마 SV08-1 굴착기 조작 도면 — 조이스틱, 주행 레버, 붐·버켓·암 기능"
          className="mx-auto w-full max-w-lg rounded-lg shadow-2xl"
          draggable={false}
        />
        <p className="mx-auto mt-3 max-w-lg text-center text-[10px] leading-relaxed text-white/55">
          ① 좌 조이스틱 · ② 주행 레버 · ⑤ 우 조이스틱 — 핀치로 확대해 보세요
        </p>
        <div className="mx-auto mt-4 max-w-lg rounded-xl border border-orange-300/20 bg-black/45 p-3 shadow-xl">
          <DigHintContent
            feedback={digFeedback}
            bucketLoad={bucketLoad}
            maxLoadUnits={maxLoadUnits}
            boom={boom}
            compact
          />
        </div>
      </div>
    </div>
  );
}
