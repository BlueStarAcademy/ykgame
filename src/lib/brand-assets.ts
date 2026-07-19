/** Official YK건기 wordmark assets (transparent WebP). */
export const YK_GEONGI_LOGO = {
  /** Black "건기" — use on white / light backgrounds */
  black: "/images/brand/yk-geongi-black.webp",
  /** White "건기" — use on dark / colored backgrounds */
  white: "/images/brand/yk-geongi-white.webp",
  aspect: 1024 / 258,
} as const;

export type YkGeongiLogoVariant = keyof Pick<typeof YK_GEONGI_LOGO, "black" | "white">;

/** Official YANMAR mark (transparent PNG) for monument / brand boards. */
export const YANMAR_MARK_LOGO = {
  src: "/images/yanmar/2d/monument/yanmar-mark.png",
  /** Intrinsic pixel aspect of the processed official asset */
  aspect: 448 / 342,
} as const;
