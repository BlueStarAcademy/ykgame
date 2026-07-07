"use client";

import type { DigFeedback } from "./bucket";

interface DigHintPanelProps {
  feedback: DigFeedback;
  bucketLoad: number;
  boom: number;
  show: boolean;
}

function boomHint(boom: number, tipOnGround: boolean) {
  if (tipOnGround) return "버킷이 땅에 닿음";
  if (boom < 0.7) return "우레버 앞으로 밀기 — 붐 하강";
  if (boom < 1.05) return "우레버 더 앞으로 — 붐 계속 내리기";
  return "좌레버 앞+뒤로 암 조절하며 버킷을 땅에";
}

export function DigHintPanel({ feedback, bucketLoad, boom, show }: DigHintPanelProps) {
  if (!show) return null;

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
            ? "좌레버 뒤로 — 암 당기며 퍼올리기"
            : "버킷 말고 암 당겨 흙 퍼올리기",
    },
  ];

  const boomPct = Math.round(
    ((boom - 0.45) / (1.45 - 0.45)) * 100,
  );

  return (
    <div className="absolute left-2 bottom-[58%] z-20 max-w-[10.5rem] rounded-lg bg-black/70 px-2 py-1.5 text-white shadow-lg backdrop-blur-sm">
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
      <div className="mt-2 flex items-center gap-2">
        <span className="shrink-0 text-[8px] text-white/50">붐</span>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-sky-400 transition-all duration-100"
            style={{ width: `${Math.max(0, Math.min(100, boomPct))}%` }}
          />
        </div>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-orange-400 transition-all duration-150"
          style={{ width: `${Math.round(bucketLoad * 100)}%` }}
        />
      </div>
      <p className="mt-0.5 text-center text-[8px] text-white/60">
        적재 {Math.round(bucketLoad * 100)}%
      </p>
    </div>
  );
}
