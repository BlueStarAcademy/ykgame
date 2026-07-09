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
    <span className={`inline-flex items-center gap-1 ${className}`.trim()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/star-currency.svg"
        alt=""
        width={size}
        height={size}
        className="shrink-0 select-none"
        draggable={false}
        aria-hidden
      />
      <span className={valueClassName}>{value.toLocaleString()}</span>
    </span>
  );
}
