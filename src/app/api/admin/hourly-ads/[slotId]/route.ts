import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  clampHourlyAdDurationMin,
  clampHourlyAdOffsetMin,
  HOURLY_AD_DURATION_MIN_MAX,
  HOURLY_AD_DURATION_MIN_MIN,
  HOURLY_AD_OFFSET_MIN_MAX,
  HOURLY_AD_OFFSET_MIN_MIN,
  isHourlyAdSlotId,
  normalizeHourlyAdLinkUrl,
} from "@/lib/hourly-ad-constants";
import { deleteHourlyAdSlot, listHourlyAdsForAdmin } from "@/lib/hourly-ads";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ slotId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { slotId: raw } = await context.params;
    if (!isHourlyAdSlotId(raw)) {
      return NextResponse.json({ error: "Unknown slot" }, { status: 404 });
    }

    const body = (await request.json().catch(() => null)) as {
      title?: unknown;
      active?: unknown;
      linkEnabled?: unknown;
      linkUrl?: unknown;
      offsetMin?: unknown;
      durationMin?: unknown;
    } | null;

    const data: {
      title?: string;
      active?: boolean;
      linkEnabled?: boolean;
      linkUrl?: string | null;
      offsetMin?: number;
      durationMin?: number;
    } = {};

    if (body?.title !== undefined) {
      if (typeof body.title !== "string") {
        return NextResponse.json({ error: "title invalid" }, { status: 400 });
      }
      const title = body.title.trim().slice(0, 80);
      if (!title) {
        return NextResponse.json(
          { error: "제목을 입력해주세요." },
          { status: 400 },
        );
      }
      data.title = title;
    }

    if (body?.active !== undefined) {
      if (typeof body.active !== "boolean") {
        return NextResponse.json({ error: "active invalid" }, { status: 400 });
      }
      data.active = body.active;
    }

    if (body?.linkEnabled !== undefined) {
      if (typeof body.linkEnabled !== "boolean") {
        return NextResponse.json(
          { error: "linkEnabled invalid" },
          { status: 400 },
        );
      }
      data.linkEnabled = body.linkEnabled;
    }

    if (body?.linkUrl !== undefined) {
      if (body.linkUrl === null || body.linkUrl === "") {
        data.linkUrl = null;
      } else {
        const url = normalizeHourlyAdLinkUrl(body.linkUrl);
        if (!url) {
          return NextResponse.json(
            { error: "링크는 http(s):// 로 시작하는 주소여야 합니다." },
            { status: 400 },
          );
        }
        data.linkUrl = url;
      }
    }

    if (body?.offsetMin !== undefined) {
      const offsetMin = clampHourlyAdOffsetMin(body.offsetMin);
      if (offsetMin == null) {
        return NextResponse.json(
          {
            error: `노출 시점은 ${HOURLY_AD_OFFSET_MIN_MIN}–${HOURLY_AD_OFFSET_MIN_MAX}분이어야 합니다.`,
          },
          { status: 400 },
        );
      }
      data.offsetMin = offsetMin;
    }

    if (body?.durationMin !== undefined) {
      const durationMin = clampHourlyAdDurationMin(body.durationMin);
      if (durationMin == null) {
        return NextResponse.json(
          {
            error: `노출 지속시간은 ${HOURLY_AD_DURATION_MIN_MIN}–${HOURLY_AD_DURATION_MIN_MAX}분이어야 합니다.`,
          },
          { status: 400 },
        );
      }
      data.durationMin = durationMin;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No changes" }, { status: 400 });
    }

    if (data.linkEnabled === true) {
      const existing = await prisma.hourlyAdSlot.findUnique({
        where: { id: raw },
        select: { linkUrl: true },
      });
      const nextUrl =
        data.linkUrl !== undefined ? data.linkUrl : existing?.linkUrl;
      if (!nextUrl) {
        return NextResponse.json(
          { error: "링크를 켠 경우 URL을 입력해주세요." },
          { status: 400 },
        );
      }
    }

    await prisma.hourlyAdSlot.update({
      where: { id: raw },
      data,
    });

    const list = await listHourlyAdsForAdmin();
    const slot = list.slots.find((item) => item.id === raw) ?? null;
    return NextResponse.json({ slot, ...list });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status =
      message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 500;
    if (status === 500) {
      console.error("[admin/hourly-ads/slot] PATCH failed:", error);
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

    const data = await deleteHourlyAdSlot(raw);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status =
      message === "FORBIDDEN"
        ? 403
        : message === "UNAUTHORIZED"
          ? 401
          : message === "Unknown slot"
            ? 404
            : 500;
    if (status === 500) {
      console.error("[admin/hourly-ads/slot] DELETE failed:", error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
