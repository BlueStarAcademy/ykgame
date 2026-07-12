"use client";

import type { DigFeedback } from "./bucket";
import { getLoadUnits } from "./equipment";

interface DigHintPanelProps {
  feedback: DigFeedback;
  bucketLoad: number;
  maxLoadUnits: number;
  boom: number;
  arm?: number;
  bucket?: number;
  show: boolean;
}

function boomHint(boom: number, tipOnGround: boolean) {
  if (tipOnGround) return "버켓이 땅에 닿음";
  if (boom < 0.7) return "우레버 앞으로 밀기 — 붐 하강";
  if (boom < 1.05) return "우레버 더 앞으로 — 붐 계속 내리기";
  return "좌레버 뒤+앞으로 암 조절하며 버켓을 땅에";
}

interface DigHintContentProps {
  feedback: DigFeedback;
  bucketLoad: number;
  maxLoadUnits: number;
  boom: number;
  arm?: number;
  bucket?: number;
  compact?: boolean;
}

export function DigHintContent({
  feedback,
  bucketLoad,
  maxLoadUnits,
  boom,
  arm,
  bucket,
  compact = false,
}: DigHintContentProps) {
  const steps = [
    {
      ok: feedback.inDigZone,
      label: feedback.inDigZone ? "주황 굴착 구역 안" : "주행·스윙으로 주황 구역 이동",
    },
    {
      ok: feedback.bucketOpenReady,
      label: feedback.bucketOpenReady
        ? "버켓 반쯤 열림"
        : "우조이스틱 오른쪽 — 버켓을 절반 이하로 열기",
    },
    {
      ok: feedback.insertedDeepEnough,
      label: feedback.insertedDeepEnough
        ? "흙더미에 깊이 들어감"
        : boomHint(boom, feedback.tipOnGround),
    },
    {
      ok: feedback.bucketCurlReady,
      label: feedback.bucketCurlReady ? "버켓 30도 말기" : "우조이스틱 왼쪽 — 버켓을 안으로 말기",
    },
    {
      ok: feedback.armPulling,
      label: feedback.armPulling ? "암 당김 중" : "좌조이스틱 뒤 — 암을 안쪽으로 당기기",
    },
    {
      ok: feedback.soilRetention >= 0.45,
      label: feedback.soilSpilling
        ? "자세가 열려 흙이 쏟아짐 — 버켓을 말아 올리기"
        : feedback.soilRetention >= 0.45
          ? "버켓이 흙을 담는 자세"
          : "버켓을 말아 올려 흙이 떨어지지 않게",
    },
    {
      ok: bucketLoad >= 0.35,
      label:
        bucketLoad >= 0.35
          ? "흙 적재 완료!"
          : feedback.digging
            ? "바닥을 긁으며 퍼올리는 중"
            : "색상 그래프를 초록 구간에 맞추기",
    },
  ];

  return (
    <div className={compact ? "text-white" : "rounded-lg bg-black/70 px-2 py-1.5 text-white"}>
      <p className="text-[10px] font-bold text-orange-300">굴착 방법</p>
      <p className="mt-0.5 text-[8px] text-white/50">
        우레버 앞=붐↓ · 뒤=붐↑ · 좌=버켓말기
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
      {compact || arm == null || bucket == null ? null : (
        <div className="mt-1 border-t border-white/10">
          <DigPoseGraph boom={boom} arm={arm} bucket={bucket} feedback={feedback} />
        </div>
      )}
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

export function GrappleGripGauge({
  adhesion,
  pressure,
}: {
  adhesion: number;
  pressure: number;
}) {
  const adhesionPct = Math.max(
    1,
    Math.min(100, Math.round(Math.min(1, adhesion) * 100)),
  );
  // 1.0 직전(≥99.5%)도 100%로 표기 — HUD 스로틀/부동소수로 99%에 고착되지 않게.
  const pressure01 = Math.min(1, Math.max(0, pressure));
  const pressurePct =
    pressure01 >= 0.995 ? 100 : Math.round(pressure01 * 100);

  return (
    <div className="min-w-[11rem] rounded-xl border border-sky-200/40 bg-slate-900/80 px-3 py-2 shadow-lg backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-[9px] font-semibold text-sky-200">밀착감</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-sky-400 transition-all duration-100"
            style={{ width: `${adhesionPct}%` }}
          />
        </div>
        <span className="w-8 text-right text-[9px] font-bold tabular-nums text-white">
          {adhesionPct}%
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="w-10 shrink-0 text-[9px] font-semibold text-slate-300">압력</span>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-slate-300/90 transition-all duration-100"
            style={{ width: `${pressurePct}%` }}
          />
        </div>
        <span className="w-8 text-right text-[8px] tabular-nums text-white/70">
          {pressurePct}%
        </span>
      </div>
    </div>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function toPct(value: number, min: number, max: number) {
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

function graphColor(ok: boolean, near: boolean) {
  if (ok) return "bg-emerald-400";
  if (near) return "bg-amber-300";
  return "bg-white/45";
}

function GraphRow({
  label,
  value,
  min,
  max,
  optimalMin,
  optimalMax,
  ok,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  optimalMin: number;
  optimalMax: number;
  ok: boolean;
}) {
  const current = toPct(value, min, max);
  const start = toPct(optimalMin, min, max);
  const end = toPct(optimalMax, min, max);
  const near =
    value >= optimalMin - (max - min) * 0.12 &&
    value <= optimalMax + (max - min) * 0.12;
  const markerColor = graphColor(ok, near);

  return (
    <div className="grid grid-cols-[2rem_1fr] items-center gap-1">
      <span className="text-[8px] font-bold text-white/70">{label}</span>
      <div className="relative h-1.5 rounded-full bg-white/15">
        <div
          className="absolute top-0 h-full rounded-full bg-emerald-400/35"
          style={{ left: `${start}%`, width: `${Math.max(4, end - start)}%` }}
        />
        <div
          className={`absolute top-1/2 h-2.5 w-1 -translate-y-1/2 rounded-full ${markerColor}`}
          style={{ left: `calc(${current}% - 2px)` }}
        />
      </div>
    </div>
  );
}

export function DigPoseGraph({
  boom,
  arm,
  bucket,
  feedback,
}: {
  boom: number;
  arm: number;
  bucket: number;
  feedback: DigFeedback;
}) {
  const scorePct = Math.round(feedback.digPoseScore * 100);

  return (
    <div className="pt-0.5">
      <div className="mb-0.5 flex items-center justify-between">
        <span className="text-[8px] font-bold text-orange-200">적재 자세</span>
        <span
          className={
            feedback.optimalDigPose
              ? "text-[8px] font-bold text-emerald-300"
              : "text-[8px] font-bold text-white/55"
          }
        >
          {feedback.optimalDigPose ? "최적" : `${scorePct}%`}
        </span>
      </div>
      <div className="space-y-px">
        <GraphRow
          label="버켓"
          value={bucket}
          min={0.35}
          max={3.6}
          optimalMin={0.35}
          optimalMax={1.1}
          ok={feedback.bucketOpenReady && feedback.bucketCurlReady}
        />
        <GraphRow
          label="붐"
          value={boom}
          min={0.06}
          max={1.45}
          optimalMin={0.65}
          optimalMax={1.2}
          ok={feedback.insertedDeepEnough}
        />
        <GraphRow
          label="암"
          value={arm}
          min={-2.05}
          max={0.55}
          optimalMin={-1.75}
          optimalMax={-0.55}
          ok={feedback.armPulling}
        />
      </div>
    </div>
  );
}

export function DigHintPanel({
  feedback,
  bucketLoad,
  maxLoadUnits,
  boom,
  arm,
  bucket,
  show,
}: DigHintPanelProps) {
  if (!show) return null;

  return (
    <div className="absolute left-2 bottom-[43%] z-20 max-w-[10.5rem] rounded-lg shadow-lg backdrop-blur-sm">
      <DigHintContent
        feedback={feedback}
        bucketLoad={bucketLoad}
        maxLoadUnits={maxLoadUnits}
        boom={boom}
        arm={arm}
        bucket={bucket}
      />
    </div>
  );
}
