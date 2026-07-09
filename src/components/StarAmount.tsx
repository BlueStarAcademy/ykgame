type StarAmountProps = {
  value: number;
  size?: number;
  className?: string;
  valueClassName?: string;
};

export function StarAmount({
  value,
  size = 14,
  className = "",
  valueClassName = "",
}: StarAmountProps) {
  return (
    <span className={`inline-flex items-center gap-1 leading-none ${className}`.trim()}>
      <span
        className="inline-flex shrink-0 items-center justify-center leading-none"
        style={{ width: size, height: size, fontSize: size }}
        aria-hidden
      >
        ⭐
      </span>
      <span className={`leading-none ${valueClassName}`.trim()}>{value.toLocaleString()}</span>
    </span>
  );
}
