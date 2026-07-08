"use client";

import type { AuxiliaryControlState, ExcavatorControlState } from "./controls";

interface CockpitControlDeckProps {
  input: ExcavatorControlState;
  auxiliary: AuxiliaryControlState;
}

type JoystickValue = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function Joystick({
  side,
  value,
}: {
  side: "left" | "right";
  value: JoystickValue;
}) {
  const x = clamp(value.x, -1, 1);
  const y = clamp(value.y, -1, 1);

  return (
    <div
      className={`absolute ${side === "left" ? "left-[17.8%]" : "left-[82.2%]"} top-[19%] h-[36%] w-[13.5%] -translate-x-1/2 -translate-y-1/2`}
      style={{
        perspective: "220px",
        transformStyle: "preserve-3d",
      }}
    >
      <div className="absolute bottom-[5%] left-1/2 h-[28%] w-[86%] -translate-x-1/2 rounded-[45%] bg-gradient-to-b from-[#323943] via-[#11151b] to-[#050608] shadow-[0_10px_16px_rgba(0,0,0,0.6),inset_0_4px_5px_rgba(255,255,255,0.08)]" />
      {[0, 1, 2, 3].map((idx) => (
        <div
          key={idx}
          className="absolute left-1/2 h-[9%] -translate-x-1/2 rounded-[48%] border border-black/65 bg-gradient-to-b from-[#2d343d] to-[#080a0d] shadow-[inset_0_2px_2px_rgba(255,255,255,0.12),0_3px_5px_rgba(0,0,0,0.42)]"
          style={{
            bottom: `${16 + idx * 6.6}%`,
            width: `${78 - idx * 7}%`,
          }}
        />
      ))}
      <div
        className="absolute bottom-[26%] left-1/2 h-[62%] w-[40%] -translate-x-1/2 rounded-[42%_42%_32%_32%] border border-[#0a0d12] bg-gradient-to-br from-[#444b55] via-[#1f252d] to-[#07090d] shadow-[0_10px_18px_rgba(0,0,0,0.58),inset_6px_6px_8px_rgba(255,255,255,0.08),inset_-8px_-9px_10px_rgba(0,0,0,0.42)] transition-transform duration-100 ease-out"
        style={{
          transform: `translate(calc(-50% + ${x * 7}%), ${-y * 5}%) rotateX(${y * 13}deg) rotateZ(${x * 12}deg)`,
          transformOrigin: "50% 92%",
        }}
      >
        <div className="absolute left-[16%] top-[7%] h-[42%] w-[42%] rounded-full bg-white/12 blur-[1px]" />
        <div className="absolute left-1/2 top-[4%] h-[18%] w-[72%] -translate-x-1/2 rounded-[50%] bg-gradient-to-br from-[#858c96] to-[#29303a] shadow-[inset_0_2px_3px_rgba(255,255,255,0.24)]" />
        {side === "right" ? (
          <div className="absolute right-[17%] top-[8%] h-[14%] w-[23%] rounded-full border border-black/70 bg-gradient-to-br from-white via-[#d7d3c8] to-[#68645d] shadow-[0_2px_3px_rgba(0,0,0,0.5)]" />
        ) : null}
      </div>
    </div>
  );
}

function TravelLever({ left, value }: { left: boolean; value: number }) {
  const y = clamp(value, -1, 1);

  return (
    <div
      className={`absolute ${left ? "left-[47.1%]" : "left-[52%]"} top-[23.8%] h-[17%] w-[3.1%] -translate-x-1/2 -translate-y-1/2`}
    >
      <div className="absolute inset-x-[28%] bottom-[4%] top-[19%] rounded-full bg-[#07090d] shadow-[inset_0_0_4px_rgba(255,255,255,0.12)]" />
      <div
        className="absolute left-1/2 top-[18%] h-[30%] w-full -translate-x-1/2 rounded-[24%] border border-black/75 bg-gradient-to-br from-[#5d6671] via-[#252c35] to-[#090b0f] shadow-[0_4px_8px_rgba(0,0,0,0.55),inset_3px_3px_4px_rgba(255,255,255,0.14)] transition-transform duration-100"
        style={{
          transform: `translate(-50%, ${-y * 38}%) rotateX(${y * 12}deg)`,
        }}
      />
    </div>
  );
}

function SafetyLever({ locked }: { locked: boolean }) {
  return (
    <div className="absolute left-[30.3%] top-[37.4%] h-[19%] w-[5.8%] -translate-x-1/2 -translate-y-1/2">
      <div className="absolute bottom-[4%] left-1/2 h-[72%] w-[34%] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#16191f] to-[#06070a] shadow-[0_5px_8px_rgba(0,0,0,0.5)]" />
      <div className="absolute bottom-[0%] left-1/2 h-[32%] w-[62%] -translate-x-1/2 rounded-[30%] bg-gradient-to-b from-[#6f1010] to-[#260607] shadow-[inset_0_2px_3px_rgba(255,255,255,0.08)]" />
      <div
        className="absolute left-1/2 h-[48%] w-[54%] -translate-x-1/2 rounded-[42%] border border-[#670909] bg-gradient-to-br from-[#ff5847] via-[#df1e1a] to-[#7f090b] shadow-[0_6px_10px_rgba(0,0,0,0.5),inset_4px_4px_5px_rgba(255,255,255,0.2)] transition-[top,transform] duration-200 ease-out"
        style={{
          top: locked ? "32%" : "10%",
          transform: `translateX(-50%) rotateX(${locked ? 13 : -6}deg)`,
        }}
      >
        <div className="absolute left-[18%] top-[12%] h-[38%] w-[32%] rounded-full bg-white/22 blur-[1px]" />
      </div>
    </div>
  );
}

function HydraulicLever({ highSpeed }: { highSpeed: boolean }) {
  return (
    <div className="absolute left-[65.4%] top-[18.2%] h-[13%] w-[4.6%] -translate-x-1/2 -translate-y-1/2">
      <div className="absolute bottom-[6%] left-1/2 h-[72%] w-[20%] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#20252d] to-black" />
      <div
        className="absolute left-1/2 h-[34%] w-[54%] -translate-x-1/2 rounded-full border border-black/70 bg-gradient-to-br from-[#abb2bc] via-[#69727d] to-[#252b33] shadow-[0_4px_8px_rgba(0,0,0,0.52),inset_3px_3px_5px_rgba(255,255,255,0.25)] transition-[top] duration-200"
        style={{ top: highSpeed ? "4%" : "38%" }}
      />
    </div>
  );
}

function Pedal({ value }: { value: number }) {
  const pressTop = Math.max(0, value);
  const pressBottom = Math.max(0, -value);

  return (
    <div className="absolute left-[65.3%] top-[48%] h-[15%] w-[6%] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-black/75 bg-gradient-to-b from-[#3b444e] via-[#181e25] to-[#07090c] shadow-[0_8px_12px_rgba(0,0,0,0.46),inset_3px_4px_6px_rgba(255,255,255,0.11)]">
      <div
        className="absolute inset-x-[12%] top-[9%] h-[39%] rounded-t-lg border border-white/10 bg-black/15 transition-transform duration-200"
        style={{ transform: `translateY(${pressTop * 0.35}rem)` }}
      />
      <div
        className="absolute inset-x-[12%] bottom-[9%] h-[39%] rounded-b-lg border border-white/10 bg-black/15 transition-transform duration-200"
        style={{ transform: `translateY(${-pressBottom * 0.35}rem)` }}
      />
      <div className="absolute left-[18%] right-[18%] top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-white/14" />
    </div>
  );
}

function ArmRest({ side }: { side: "left" | "right" }) {
  return (
    <div
      className={`absolute ${side === "left" ? "left-[6.6%]" : "left-[93.4%]"} top-[69%] h-[30%] w-[11%] -translate-x-1/2 -translate-y-1/2 rounded-[18%] border border-black/70 bg-gradient-to-br from-[#3e454f] via-[#20262e] to-[#0a0c10] shadow-[0_10px_16px_rgba(0,0,0,0.55),inset_3px_4px_5px_rgba(255,255,255,0.06)]`}
      style={{ transform: `translate(-50%, -50%) rotate(${side === "left" ? 9 : -9}deg)` }}
    />
  );
}

export function CockpitControlDeck({ input, auxiliary }: CockpitControlDeckProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 mx-auto w-full max-w-lg">
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <div className="absolute inset-0 overflow-hidden rounded-t-[2rem] bg-gradient-to-b from-slate-300 via-slate-400 to-slate-500">
          <div className="absolute bottom-[4%] left-1/2 h-[15%] w-[93%] -translate-x-1/2 rounded-[50%] bg-gradient-to-b from-[#e3372f] to-[#9b1114] shadow-[0_10px_18px_rgba(0,0,0,0.34),inset_0_3px_4px_rgba(255,255,255,0.2)]" />
          <div className="absolute bottom-[5%] left-1/2 h-[34%] w-[47%] -translate-x-1/2 rounded-[18%_18%_10%_10%] border border-black/55 bg-gradient-to-b from-[#aeb7c1] via-[#89939e] to-[#6f7984] shadow-[0_8px_13px_rgba(0,0,0,0.42),inset_0_5px_8px_rgba(255,255,255,0.16)]">
            <div className="absolute left-[8%] right-[8%] top-[36%] h-[2px] bg-black/28" />
            <div className="absolute left-[9%] right-[9%] top-[62%] h-[2px] bg-black/28" />
          </div>

          <div className="absolute left-[19%] top-[63%] h-[44%] w-[24%] -translate-x-1/2 -translate-y-1/2 rounded-[22%] border border-black/60 bg-gradient-to-br from-[#b9c1ca] via-[#8d98a4] to-[#64707c] shadow-[0_9px_14px_rgba(0,0,0,0.45),inset_7px_7px_10px_rgba(255,255,255,0.14)]" />
          <div className="absolute left-[81%] top-[63%] h-[44%] w-[24%] -translate-x-1/2 -translate-y-1/2 rounded-[22%] border border-black/60 bg-gradient-to-bl from-[#b9c1ca] via-[#8d98a4] to-[#64707c] shadow-[0_9px_14px_rgba(0,0,0,0.45),inset_-7px_7px_10px_rgba(255,255,255,0.14)]" />

          <ArmRest side="left" />
          <ArmRest side="right" />

          <div className="absolute left-1/2 top-[34%] h-[31%] w-[31%] -translate-x-1/2 -translate-y-1/2 rounded-[16%] border border-black/65 bg-gradient-to-b from-[#ef362d] via-[#d91f1d] to-[#5e1112] shadow-[0_10px_16px_rgba(0,0,0,0.5),inset_0_5px_7px_rgba(255,255,255,0.2)]">
            <div className="absolute bottom-[9%] left-1/2 h-[55%] w-[82%] -translate-x-1/2 rounded-[14%] border border-black/65 bg-gradient-to-b from-[#37404b] to-[#11161d]" />
            <div className="absolute left-[16%] top-[21%] h-[11%] w-[12%] rounded bg-gradient-to-br from-[#8fff68] to-[#1d8a28] shadow-[inset_0_2px_3px_rgba(255,255,255,0.35)]" />
            <div className="absolute left-[30%] top-[20%] h-[13%] w-[10%] rounded bg-gradient-to-b from-[#444b55] to-[#13171d]" />
            <div className="absolute right-[26%] top-[18%] h-[15%] w-[9%] rounded bg-gradient-to-b from-[#9ba8b5] to-[#43505d]" />
            <div className="absolute right-[15%] top-[18%] h-[15%] w-[9%] rounded bg-gradient-to-b from-[#a8b4c0] to-[#44515d]" />
          </div>

          <Joystick side="left" value={input.left} />
          <Joystick side="right" value={input.right} />
          <TravelLever left value={input.travel.left} />
          <TravelLever left={false} value={input.travel.right} />
          <SafetyLever locked={auxiliary.safetyLocked} />
          <HydraulicLever highSpeed={auxiliary.highSpeed} />
          <Pedal value={auxiliary.boomSwing} />
        </div>
      </div>
    </div>
  );
}
