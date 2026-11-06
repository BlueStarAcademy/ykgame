import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  HOURLY_AD_ALLOWED_MIME,
  HOURLY_AD_UPLOAD_MAX_BYTES,
  isHourlyAdSlotId,
} from "@/lib/hourly-ad-constants";
import {
  convertHourlyAdImageToWebp,
  normalizeHourlyAdUploadMime,
} from "@/lib/hourly-ad-image";
import { listHourlyAdsForAdmin } from "@/lib/hourly-ads";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ slotId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { slotId: raw } = await context.params;
    if (!isHourlyAdSlotId(raw)) {
      return NextResponse.json({ error: "Unknown slot" }, { status: 404 });
    }

    const form = await request.formData().catch(() => null);
    const entry = form?.get("file") ?? null;
    if (!(entry instanceof Blob) || entry.size <= 0) {
      return NextResponse.json(
        { error: "이미지 파일이 필요합니다." },
        { status: 400 },
      );
    }
    const file = entry;

    const fileName = entry instanceof File ? entry.name : null;
    const mime = normalizeHourlyAdUploadMime(file.type, fileName);
    if (!mime || !HOURLY_AD_ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        {
          error: `지원하지 않는 형식입니다${file.type ? ` (${file.type})` : ""}. PNG, JPEG, WebP, GIF만 업로드할 수 있습니다.`,
        },
        { status: 400 },
      );
    }
    if (file.size > HOURLY_AD_UPLOAD_MAX_BYTES) {
      return NextResponse.json(
        { error: "원본 이미지는 20MB 이하여야 합니다." },
        { status: 400 },
      );
    }

    const source = Buffer.from(await file.arrayBuffer());
    let converted: { data: Buffer; mime: "image/webp" };
    try {
      converted = await convertHourlyAdImageToWebp(source);
    } catch (error) {
      console.error("[admin/hourly-ads/image] convert failed:", error);
      const message =
        error instanceof Error
          ? error.message
          : "이미지 변환에 실패했습니다.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    await prisma.hourlyAdSlot.update({
      where: { id: raw },
      data: {
        imageMime: converted.mime,
        imageData: new Uint8Array(converted.data),
      },
    });

    const list = await listHourlyAdsForAdmin();
    const slot = list.slots.find((item) => item.id === raw) ?? null;
    return NextResponse.json({ slot, ...list });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status =
      message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 500;
    if (status === 500) {
      console.error("[admin/hourly-ads/image] POST failed:", error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { slotId: raw } = await context.params;
    if (!isHourlyAdSlotId(raw)) {
      return NextResponse.json({ error: "Unknown slot" }, { status: 404 });
    }

    await prisma.hourlyAdSlot.update({
      where: { id: raw },
      data: {
        imageMime: null,
        imageData: null,
      },
    });

    const list = await listHourlyAdsForAdmin();
    const slot = list.slots.find((item) => item.id === raw) ?? null;
    return NextResponse.json({ slot, ...list });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status =
      message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 500;
    if (status === 500) {
      console.error("[admin/hourly-ads/image] DELETE failed:", error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
