import {
  YK_GEONGI_LOGO,
  type YkGeongiLogoVariant,
} from "@/lib/brand-assets";

interface YkGeongiLogoProps {
  /** `black` = black "건기" for white backgrounds; `white` = white "건기" otherwise */
  variant?: YkGeongiLogoVariant;
  className?: string;
  alt?: string;
  priority?: boolean;
}

export function YkGeongiLogo({
  variant = "black",
  className,
  alt = "YK건기",
  priority = false,
}: YkGeongiLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand mark; avoid next/image layout shift in badges
    <img
      src={YK_GEONGI_LOGO[variant]}
      alt={alt}
      className={className}
      draggable={false}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
    />
  );
}
