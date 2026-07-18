/** Official YK건기 wordmark assets (transparent WebP). */
export const YK_GEONGI_LOGO = {
  /** Black "건기" — use on white / light backgrounds */
  black: "/images/brand/yk-geongi-black.webp",
  /** White "건기" — use on dark / colored backgrounds */
  white: "/images/brand/yk-geongi-white.webp",
  aspect: 1024 / 258,
} as const;

export type YkGeongiLogoVariant = keyof Pick<typeof YK_GEONGI_LOGO, "black" | "white">;
