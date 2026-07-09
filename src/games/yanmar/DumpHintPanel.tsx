"use client";

interface DumpHintPanelProps {
  bucketLoad: number;
  inDumpZone: boolean;
  canDump: boolean;
  raiseArmForDump: boolean;
  show: boolean;
}

export function DumpHintPanel({
  bucketLoad,
  inDumpZone,
  canDump,
  raiseArmForDump,
  show,
}: DumpHintPanelProps) {
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
      ok: !raiseArmForDump && (canDump || inDumpZone),
      label: raiseArmForDump
        ? "우조이스틱 뒤로 — 붐·암 들어 트럭 칸 위로"
        : inDumpZone
          ? "트럭 칸 위 — 버킷 위치 맞춤"
          : "트럭 쪽으로 스윙·주행",
    },
    {
      ok: canDump,
      label: canDump
        ? "우조이스틱 오른쪽으로 버킷 펴기"
        : raiseArmForDump
          ? "먼저 붐·암을 들어올리세요"
          : "트럭 칸 위로 버킷·차체를 더 올려주세요",
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
