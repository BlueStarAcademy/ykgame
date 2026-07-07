"use client";

interface DumpHintPanelProps {
  bucketLoad: number;
  inDumpZone: boolean;
  show: boolean;
}

export function DumpHintPanel({ bucketLoad, inDumpZone, show }: DumpHintPanelProps) {
  if (!show) return null;

  const steps = [
    {
      ok: bucketLoad >= 0.1,
      label: bucketLoad >= 0.1 ? `흙 적재 ${Math.round(bucketLoad * 100)}%` : "흙이 없습니다 — 6번부터 다시",
    },
    {
      ok: inDumpZone,
      label: inDumpZone ? "초록 하역 구역 안" : "주행·스윙으로 초록 구역 이동",
    },
    {
      ok: false,
      label: "우조버 왼쪽 — 버킷 펴기",
    },
  ];

  return (
    <div className="absolute left-2 top-2 z-20 max-w-[11.5rem] rounded-lg bg-black/75 px-2.5 py-2 text-white backdrop-blur-sm">
      <p className="text-[10px] font-bold text-emerald-300">하역 방법</p>
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
    </div>
  );
}
