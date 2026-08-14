"use client";

import { useLocale } from "next-intl";
import type { ImgHTMLAttributes } from "react";
import { type Locale } from "@/i18n/config";
import { localizedAsset } from "@/i18n/localizedAsset";

type LocalizedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
};

/** img that swaps to locale-suffixed asset paths (ko = original). */
export function LocalizedImage({ src, onError, ...rest }: LocalizedImageProps) {
  const locale = useLocale() as Locale;
  const localized = localizedAsset(src, locale);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      src={localized}
      onError={(e) => {
        // Missing ja/en asset → fall back to Korean original
        if (localized !== src && e.currentTarget.src.endsWith(localized)) {
          e.currentTarget.src = src;
        }
        onError?.(e);
      }}
    />
  );
}
