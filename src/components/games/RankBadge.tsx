"use client";

type RankPlace = 1 | 2 | 3;

const MEDAL_META: Record<
  RankPlace,
  { label: string; rim: string; face: string; shine: string; ink: string }
> = {
  1: {
    label: "1",
    rim: "#C9A227",
    face: "#F0D060",
    shine: "#FFF4C2",
    ink: "#5C3D00",
  },
  2: {
    label: "2",
    rim: "#8A94A6",
    face: "#C8D0DC",
    shine: "#F4F7FA",
    ink: "#2F3848",
  },
  3: {
    label: "3",
    rim: "#A05A2C",
    face: "#D08A4A",
    shine: "#F0C090",
    ink: "#4A2408",
  },
};

function MedalGlyph({ place, size }: { place: RankPlace; size: number }) {
  const meta = MEDAL_META[place];
  const id = `rank-medal-${place}-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      className="block"
    >
      <defs>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={meta.shine} />
          <stop offset="42%" stopColor={meta.face} />
          <stop offset="100%" stopColor={meta.rim} />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={meta.shine} stopOpacity="0.95" />
          <stop offset="55%" stopColor={meta.rim} />
          <stop offset="100%" stopColor={meta.rim} stopOpacity="0.75" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
        </radialGradient>
      </defs>

      {/* soft outer halo */}
      <circle cx="16" cy="16" r="15" fill={meta.rim} opacity="0.22" />

      {/* medal body */}
      <circle cx="16" cy="16" r="12.5" fill={`url(#${id}-rim)`} />
      <circle cx="16" cy="16" r="10.4" fill={`url(#${id}-face)`} />
      <circle cx="16" cy="16" r="10.4" fill={`url(#${id}-glow)`} />

      {/* inner engraved ring */}
      <circle
        cx="16"
        cy="16"
        r="8.2"
        fill="none"
        stroke={meta.ink}
        strokeOpacity="0.28"
        strokeWidth="0.9"
      />
      <circle
        cx="16"
        cy="16"
        r="7.2"
        fill="none"
        stroke={meta.shine}
        strokeOpacity="0.35"
        strokeWidth="0.6"
      />

      {/* rank numeral */}
      <text
        x="16"
        y="16.5"
        textAnchor="middle"
        dominantBaseline="central"
        fill={meta.ink}
        fontSize="11"
        fontWeight="800"
        fontFamily="Georgia, 'Times New Roman', serif"
        letterSpacing="-0.02em"
      >
        {meta.label}
      </text>
    </svg>
  );
}

export function RankBadge({
  rank,
  size = "md",
  tone = "light",
}: {
  rank: number;
  size?: "sm" | "md";
  /** light = ranking modal on white; dark = in-game result panel */
  tone?: "light" | "dark";
}) {
  const px = size === "sm" ? 22 : 28;
  const box = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  if (rank <= 0) {
    return (
      <span
        className={`flex ${box} shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
          tone === "dark" ? "bg-white/8 text-white/40" : "bg-slate-100 text-slate-400"
        }`}
      >
        -
      </span>
    );
  }

  if (rank === 1 || rank === 2 || rank === 3) {
    return (
      <span
        className={`flex ${box} shrink-0 items-center justify-center`}
        title={`${rank}위`}
        aria-label={`${rank}위`}
      >
        <MedalGlyph place={rank} size={px} />
      </span>
    );
  }

  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-lg text-xs font-black tabular-nums ${
        tone === "dark"
          ? "bg-white/8 text-white/65"
          : "bg-slate-100 text-slate-600"
      }`}
      aria-label={`${rank}위`}
    >
      {rank}
    </span>
  );
}
