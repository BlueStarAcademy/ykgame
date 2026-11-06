import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  clampHourlyAdDurationMin,
  clampHourlyAdOffsetMin,
  HOURLY_AD_DURATION_MIN_DEFAULT,
  HOURLY_AD_DURATION_MIN_MAX,
  HOURLY_AD_DURATION_MIN_MIN,
  HOURLY_AD_OFFSET_MIN_MAX,
  HOURLY_AD_OFFSET_MIN_MIN,
  normalizeHourlyAdLinkUrl,
} from "@/lib/hourly-ad-constants";
import { createHourlyAdSlot, listHourlyAdsForAdmin } from "@/lib/hourly-ads";

export async function GET() {
  try {
    await requireAdmin();
    const data = await listHourlyAdsForAdmin();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("[admin/hourly-ads] GET failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json().catch(() => null)) as {
      title?: unknown;
      offsetMin?: unknown;
      durationMin?: unknown;
      active?: unknown;
      linkEnabled?: unknown;
      linkUrl?: unknown;
    } | null;

    const title =
      typeof body?.title === "string" ? body.title.trim().slice(0, 80) : "";
    if (!title) {
      return NextResponse.json(
        { error: "제목을 입력해주세요." },
        { status: 400 },
      );
    }

    const offsetMin = clampHourlyAdOffsetMin(body?.offsetMin);
    if (offsetMin == null) {
      return NextResponse.json(
        {
          error: `노출 시점은 ${HOURLY_AD_OFFSET_MIN_MIN}–${HOURLY_AD_OFFSET_MIN_MAX}분이어야 합니다.`,
        },
        { status: 400 },
      );
    }

    const durationMin =
      clampHourlyAdDurationMin(body?.durationMin) ??
      HOURLY_AD_DURATION_MIN_DEFAULT;
    if (
      body?.durationMin !== undefined &&
      clampHourlyAdDurationMin(body.durationMin) == null
    ) {
      return NextResponse.json(
        {
          error: `노출 지속시간은 ${HOURLY_AD_DURATION_MIN_MIN}–${HOURLY_AD_DURATION_MIN_MAX}분이어야 합니다.`,
        },
        { status: 400 },
      );
    }

    const linkEnabled = body?.linkEnabled === true;
    let linkUrl: string | null = null;
    if (body?.linkUrl !== undefined && body.linkUrl !== null && body.linkUrl !== "") {
      linkUrl = normalizeHourlyAdLinkUrl(body.linkUrl);
      if (!linkUrl) {
        return NextResponse.json(
          { error: "링크는 http(s):// 로 시작하는 주소여야 합니다." },
          { status: 400 },
        );
      }
    }
    if (linkEnabled && !linkUrl) {
      return NextResponse.json(
        { error: "링크를 켠 경우 URL을 입력해주세요." },
        { status: 400 },
      );
    }

    const data = await createHourlyAdSlot({
      title,
      offsetMin,
      durationMin,
      active: body?.active !== false,
      linkEnabled,
      linkUrl,
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status =
      message === "FORBIDDEN"
        ? 403
        : message === "UNAUTHORIZED"
          ? 401
          : message.includes("최대")
            ? 400
            : 500;
    if (status === 500) {
      console.error("[admin/hourly-ads] POST failed:", error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
