type StarAmountProps = {
  value: number;
  size?: number;
  className?: string;
  valueClassName?: string;
};

const STAR_CURRENCY_ICON = "/images/star-currency.svg";

export function StarAmount({
  value,
  size = 14,
  className = "",
  valueClassName = "",
}: StarAmountProps) {
  return (
    <span className={`inline-flex items-center gap-1 leading-none ${className}`.trim()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={STAR_CURRENCY_ICON}
        alt=""
        width={size}
        height={size}
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
        draggable={false}
        aria-hidden
      />
      <span className={`leading-none ${valueClassName}`.trim()}>{value.toLocaleString()}</span>
    </span>
  );
}
