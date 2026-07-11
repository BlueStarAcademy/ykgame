"use client";

interface DumpHintPanelProps {
  bucketLoad: number;
  dumpBodyTouching: boolean;
  dumpFacingBed: boolean;
  canDump: boolean;
  raiseArmForDump: boolean;
  truckCooldownRemaining?: number;
  truckCanAccept?: boolean;
  show: boolean;
}

export function DumpHintPanel({
  bucketLoad,
  dumpBodyTouching,
  dumpFacingBed,
  canDump,
  raiseArmForDump,
  truckCooldownRemaining = 0,
  truckCanAccept = true,
  show,
}: DumpHintPanelProps) {
  if (!show) return null;

  const aligned = dumpBodyTouching && dumpFacingBed;

  const steps = [
    {
      ok: bucketLoad >= 0.1,
      label:
        bucketLoad >= 0.1
          ? `흙 적재 ${Math.round(bucketLoad * 100)}%`
          : "흙이 없습니다 — 6번부터 다시",
    },
    {
      ok: dumpBodyTouching,
      label: dumpBodyTouching
        ? "차체가 트럭에 붙음"
        : "트럭 옆에 차체를 붙이세요",
    },
    {
      ok: dumpFacingBed,
      label: dumpFacingBed
        ? "정면이 짐칸 중심을 향함"
        : "스윙으로 정면을 짐칸 중심에 맞추세요",
    },
    {
      ok:
        truckCooldownRemaining <= 0 &&
        truckCanAccept &&
        (canDump || aligned),
      label:
        truckCooldownRemaining > 0
          ? `다음 트럭 대기 ${Math.ceil(truckCooldownRemaining)}초`
          : !truckCanAccept
            ? "트럭 만차 — 하역 구역을 벗어나면 출발"
            : canDump
              ? "우조이스틱 오른쪽으로 버켓 펴기"
              : raiseArmForDump
                ? "먼저 붐·암을 들어올리세요"
                : "차체 밀착과 정면 방향을 맞춰주세요",
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
