import { formatXpProgress, type PlayerLevelProgress } from "@/lib/playerLevel";

interface XpProgressBarProps {
  progress: PlayerLevelProgress;
  compact?: boolean;
  className?: string;
  barClassName?: string;
  labelClassName?: string;
  showLabel?: boolean;
}

export function XpProgressBar({
  progress,
  compact = false,
  className = "",
  barClassName = "",
  labelClassName = "",
  showLabel = true,
}: XpProgressBarProps) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div
        className={`overflow-hidden rounded-full bg-black/25 ${
          compact ? "h-1.5" : "h-2"
        } ${barClassName}`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-300 transition-[width] duration-300"
          style={{ width: `${Math.max(0, Math.min(100, progress.progressPct))}%` }}
        />
      </div>
      {showLabel ? (
        <p
          className={`mt-0.5 tabular-nums ${
            compact ? "text-[9px] font-bold" : "text-[10px] font-semibold"
          } ${labelClassName}`}
        >
          경험치 {formatXpProgress(progress)}
        </p>
      ) : null}
    </div>
  );
}
