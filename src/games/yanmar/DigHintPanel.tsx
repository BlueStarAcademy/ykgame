"use client";

import type { DigFeedback } from "./bucket";
import { getLoadUnits } from "./equipment";

interface DigHintPanelProps {
  feedback: DigFeedback;
  bucketLoad: number;
  maxLoadUnits: number;
  boom: number;
  show: boolean;
}

function boomHint(boom: number, tipOnGround: boolean) {
  if (tipOnGround) return "버킷이 땅에 닿음";
  if (boom < 0.7) return "우레버 앞으로 밀기 — 붐 하강";
  if (boom < 1.05) return "우레버 더 앞으로 — 붐 계속 내리기";
  return "좌레버 뒤+앞으로 암 조절하며 버킷을 땅에";
}

interface DigHintContentProps {
  feedback: DigFeedback;
  bucketLoad: number;
  maxLoadUnits: number;
  boom: number;
  compact?: boolean;
}

export function DigHintContent({
  feedback,
  bucketLoad,
  maxLoadUnits,
  boom,
  compact = false,
}: DigHintContentProps) {
  const steps = [
    {
      ok: feedback.inDigZone,
      label: feedback.inDigZone ? "주황 굴착 구역 안" : "주행·스윙으로 주황 구역 이동",
    },
    {
      ok: feedback.tipOnGround,
      label: boomHint(boom, feedback.tipOnGround),
    },
    {
      ok: feedback.bucketCurled,
      label: feedback.bucketCurled ? "버킷 말기 완료" : "우조버 왼쪽 — 버킷 말기",
    },
    {
      ok: bucketLoad >= 0.35,
      label:
        bucketLoad >= 0.35
          ? "흙 적재 완료!"
          : feedback.digging
            ? "좌레버 뒤로 — 암을 뻗으며 퍼올리기"
            : "버킷 말고 암을 뻗어 흙 퍼올리기",
    },
  ];

  return (
    <div className={compact ? "text-white" : "rounded-lg bg-black/70 px-2 py-1.5 text-white"}>
      <p className="text-[10px] font-bold text-orange-300">굴착 방법</p>
      <p className="mt-0.5 text-[8px] text-white/50">
        우레버 앞=붐↓ · 뒤=붐↑ · 좌=버킷말기
      </p>
      <ul className="mt-1.5 space-y-1">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[9px] leading-tight">
            <span className={s.ok ? "text-emerald-400" : "text-white/40"}>
              {s.ok ? "✓" : "○"}
            </span>
            <span className={s.ok ? "text-white/90" : "text-white/65"}>{s.label}</span>
          </li>
        ))}
      </ul>
      {compact ? null : <BoomLoadGauge bucketLoad={bucketLoad} maxLoadUnits={maxLoadUnits} />}
    </div>
  );
}

export function BoomLoadGauge({
  bucketLoad,
  maxLoadUnits,
}: {
  bucketLoad: number;
  maxLoadUnits: number;
}) {
  const loadPct =
    bucketLoad <= 0 ? 0 : Math.max(1, Math.min(100, Math.round(bucketLoad * 100)));
  const loadUnits = getLoadUnits(bucketLoad, maxLoadUnits);

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="w-8 shrink-0 text-[9px] font-semibold text-orange-200">적재</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-orange-400 transition-all duration-150"
            style={{ width: `${loadPct}%` }}
          />
        </div>
        <span className="w-[4.5rem] text-right text-[9px] text-white/80">
          {loadUnits} / {maxLoadUnits}
        </span>
      </div>
    </div>
  );
}

export function DigHintPanel({ feedback, bucketLoad, maxLoadUnits, boom, show }: DigHintPanelProps) {
  if (!show) return null;

  return (
    <div className="absolute left-2 bottom-[43%] z-20 max-w-[10.5rem] rounded-lg shadow-lg backdrop-blur-sm">
      <DigHintContent
        feedback={feedback}
        bucketLoad={bucketLoad}
        maxLoadUnits={maxLoadUnits}
        boom={boom}
      />
    </div>
  );
}
