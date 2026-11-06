import sharp from "sharp";
import {
  HOURLY_AD_IMAGE_MAX_BYTES,
  HOURLY_AD_WEBP_MAX_WIDTH,
} from "@/lib/hourly-ad-constants";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
};

export function normalizeHourlyAdUploadMime(
  type: string | null | undefined,
  fileName?: string | null,
): string | null {
  const raw = (type ?? "").trim().toLowerCase();
  if (raw && raw !== "application/octet-stream") {
    return MIME_ALIASES[raw] ?? raw;
  }
  const name = (fileName ?? "").trim().toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot < 0) return null;
  return MIME_BY_EXT[name.slice(dot)] ?? null;
}

/**
 * Convert an uploaded ad image to WebP, shrinking quality/width until it fits
 * under HOURLY_AD_IMAGE_MAX_BYTES.
 */
export async function convertHourlyAdImageToWebp(input: Buffer): Promise<{
  data: Buffer;
  mime: "image/webp";
}> {
  try {
    await sharp(input, { animated: false, failOn: "none" }).metadata();
  } catch {
    throw new Error("이미지 파일을 읽을 수 없습니다. PNG/JPEG/WebP/GIF를 사용해주세요.");
  }

  let width = HOURLY_AD_WEBP_MAX_WIDTH;
  let quality = 82;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const data = await sharp(input, { animated: false, failOn: "none" })
        .rotate()
        .resize({
          width,
          height: Math.round(width * 2.5),
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality, effort: 4 })
        .toBuffer();

      if (data.length <= HOURLY_AD_IMAGE_MAX_BYTES) {
        return { data, mime: "image/webp" };
      }
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `이미지 변환 실패: ${error.message}`
          : "이미지 변환에 실패했습니다.",
      );
    }

    if (quality > 35) {
      quality -= 10;
      continue;
    }
    if (width <= 360) break;
    width = Math.max(360, Math.round(width * 0.7));
    quality = 68;
  }

  throw new Error("이미지를 2MB 이하 WebP로 줄이지 못했습니다. 다른 파일을 시도해주세요.");
}
