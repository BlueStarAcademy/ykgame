import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { couponTypeLabel, getSeasonCouponLimit } from "@/lib/coupon";
import {
  formatSeasonLabel,
  getSeasonEndDate,
  getSeasonInfo,
  listRecentSeasonKeys,
  parseSeasonKey,
} from "@/lib/games";
import type { CouponType } from "@/generated/prisma/client";

const COUPON_TYPES: CouponType[] = [
  "YK_PARTS_DISCOUNT",
  "EQUIPMENT_RENTAL_DISCOUNT",
  "FILTER_SET_EXCHANGE",
];

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const currentSeason = getSeasonInfo();
  const requestedKey = searchParams.get("seasonKey");
  const seasonKey =
    requestedKey && parseSeasonKey(requestedKey)
      ? requestedKey
      : currentSeason.key;

  const [quotas, recentCoupons, distinctSeasons] = await Promise.all([
    Promise.all(
      COUPON_TYPES.map(async (type) => {
        const [issued, mailIssued] = await Promise.all([
          prisma.userCoupon.count({
            where: { type, seasonKey, fromGameDrop: true },
          }),
          prisma.userCoupon.count({
            where: { type, seasonKey, fromGameDrop: false },
          }),
        ]);
        const limit = getSeasonCouponLimit(type);
        return {
          type,
          label: couponTypeLabel(type),
          limit,
          issued,
          remaining: Math.max(0, limit - issued),
          mailIssued,
        };
      }),
    ),
    prisma.userCoupon.findMany({
      where: { seasonKey },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        type: true,
        discountPct: true,
        barcodeCode: true,
        seasonKey: true,
        fromGameDrop: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            loginId: true,
            nickname: true,
            email: true,
          },
        },
      },
    }),
    prisma.userCoupon.findMany({
      distinct: ["seasonKey"],
      select: { seasonKey: true },
      orderBy: { seasonKey: "desc" },
    }),
  ]);

  const seasonKeySet = new Set<string>([
    ...listRecentSeasonKeys(currentSeason.key, 8),
    ...distinctSeasons.map((row) => row.seasonKey),
    seasonKey,
  ]);

  const seasons = Array.from(seasonKeySet)
    .filter((key) => parseSeasonKey(key))
    .sort((a, b) => {
      const pa = parseSeasonKey(a)!;
      const pb = parseSeasonKey(b)!;
      if (pa.year !== pb.year) return pb.year - pa.year;
      return pb.season - pa.season;
    })
    .map((key) => ({
      key,
      label: formatSeasonLabel(key),
      isCurrent: key === currentSeason.key,
    }));

  const totalRemaining = quotas.reduce((sum, q) => sum + q.remaining, 0);
  const totalLimit = quotas.reduce((sum, q) => sum + q.limit, 0);
  const totalIssued = quotas.reduce((sum, q) => sum + q.issued, 0);

  return NextResponse.json({
    season: {
      key: seasonKey,
      label: formatSeasonLabel(seasonKey),
      endsAt: getSeasonEndDate(seasonKey).toISOString(),
      isCurrent: seasonKey === currentSeason.key,
    },
    seasons,
    couponTypes: COUPON_TYPES.map((type) => ({
      type,
      label: couponTypeLabel(type),
    })),
    summary: {
      totalRemaining,
      totalLimit,
      totalIssued,
    },
    quotas,
    coupons: recentCoupons.map((coupon) => ({
      ...coupon,
      typeLabel: couponTypeLabel(coupon.type),
      source: coupon.fromGameDrop ? "game" : "mail",
    })),
  });
}
