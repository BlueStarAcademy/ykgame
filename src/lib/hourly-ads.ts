import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  HOURLY_AD_DEFAULT_SLOTS,
  HOURLY_AD_DURATION_MIN_DEFAULT,
  HOURLY_AD_FALLBACK_IMAGE_PATH,
  HOURLY_AD_MAX_SLOTS,
  isHourlyAdSlotId,
  type HourlyAdSlotId,
} from "@/lib/hourly-ad-constants";

export type HourlyAdSlotPublic = {
  id: HourlyAdSlotId;
  sortOrder: number;
  title: string;
  offsetMin: number;
  durationMin: number;
  imageUrl: string;
  /** True when admin uploaded a custom image (no locale variants). */
  hasCustomImage: boolean;
  defaultImagePath: string;
  linkEnabled: boolean;
  linkUrl: string | null;
  active: boolean;
  updatedAt: string;
};

export type HourlyAdPublicConfig = {
  slots: HourlyAdSlotPublic[];
};

export type CreateHourlyAdSlotInput = {
  title: string;
  offsetMin: number;
  durationMin: number;
  active?: boolean;
  linkEnabled?: boolean;
  linkUrl?: string | null;
};

function imageUrlForSlot(slotId: HourlyAdSlotId, updatedAt: Date, hasCustom: boolean) {
  if (!hasCustom) return null;
  return `/api/hourly-ads/${slotId}/image?v=${updatedAt.getTime()}`;
}

function mapSlotPublic(slot: {
  id: string;
  sortOrder: number;
  title: string;
  offsetMin: number;
  durationMin: number;
  defaultImagePath: string;
  imageMime: string | null;
  linkEnabled: boolean;
  linkUrl: string | null;
  active: boolean;
  updatedAt: Date;
}): HourlyAdSlotPublic | null {
  if (!isHourlyAdSlotId(slot.id)) return null;
  const id = slot.id;
  const hasCustomImage = Boolean(slot.imageMime);
  const customUrl = imageUrlForSlot(id, slot.updatedAt, hasCustomImage);
  const defaultImagePath =
    slot.defaultImagePath || HOURLY_AD_FALLBACK_IMAGE_PATH;
  return {
    id,
    sortOrder: slot.sortOrder,
    title: slot.title,
    offsetMin: slot.offsetMin,
    durationMin: slot.durationMin,
    imageUrl: customUrl ?? defaultImagePath,
    hasCustomImage,
    defaultImagePath,
    linkEnabled: slot.linkEnabled && Boolean(slot.linkUrl),
    linkUrl: slot.linkEnabled ? slot.linkUrl : null,
    active: slot.active,
    updatedAt: slot.updatedAt.toISOString(),
  };
}

async function ensureHourlyAdDefaults() {
  const count = await prisma.hourlyAdSlot.count();
  if (count > 0) return;
  for (const slot of HOURLY_AD_DEFAULT_SLOTS) {
    await prisma.hourlyAdSlot.create({
      data: {
        id: slot.id,
        sortOrder: slot.sortOrder,
        title: slot.title,
        offsetMin: slot.offsetMin,
        durationMin: slot.durationMin,
        defaultImagePath: slot.defaultImagePath,
        active: true,
        linkEnabled: false,
      },
    });
  }
}

async function renumberHourlyAdSlots() {
  const slots = await prisma.hourlyAdSlot.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  await prisma.$transaction(
    slots.map((slot, index) =>
      prisma.hourlyAdSlot.update({
        where: { id: slot.id },
        data: { sortOrder: index },
      }),
    ),
  );
}

const SLOT_SELECT = {
  id: true,
  sortOrder: true,
  title: true,
  offsetMin: true,
  durationMin: true,
  defaultImagePath: true,
  imageMime: true,
  linkEnabled: true,
  linkUrl: true,
  active: true,
  updatedAt: true,
} as const;

export async function getHourlyAdPublicConfig(): Promise<HourlyAdPublicConfig> {
  await ensureHourlyAdDefaults();

  const slots = await prisma.hourlyAdSlot.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: SLOT_SELECT,
  });

  return {
    slots: slots
      .map(mapSlotPublic)
      .filter((slot): slot is HourlyAdSlotPublic => slot !== null)
      // Only expose slots that have art (custom upload or seeded default path).
      .filter(
        (slot) =>
          slot.hasCustomImage ||
          Boolean(slot.defaultImagePath && slot.defaultImagePath.length > 0),
      ),
  };
}

export async function getHourlyAdSlotImage(slotId: HourlyAdSlotId) {
  await ensureHourlyAdDefaults();
  const slot = await prisma.hourlyAdSlot.findUnique({
    where: { id: slotId },
    select: {
      imageData: true,
      imageMime: true,
      defaultImagePath: true,
      updatedAt: true,
    },
  });
  if (!slot) return null;
  if (slot.imageData && slot.imageData.length > 0 && slot.imageMime) {
    return {
      kind: "bytes" as const,
      data: Buffer.from(slot.imageData),
      mime: slot.imageMime,
      updatedAt: slot.updatedAt,
    };
  }
  const path = slot.defaultImagePath || HOURLY_AD_FALLBACK_IMAGE_PATH;
  return {
    kind: "path" as const,
    path,
    updatedAt: slot.updatedAt,
  };
}

/** Sync server-side runtime schedule (claim route) with DB config. */
export async function syncHourlyAdRuntimeFromDb() {
  const { applyHourlyAdPublicConfig } = await import(
    "@/games/yanmar/hourlyAdReward"
  );
  const config = await getHourlyAdPublicConfig();
  applyHourlyAdPublicConfig(config);
  return config;
}

export async function listHourlyAdsForAdmin() {
  await ensureHourlyAdDefaults();

  const slots = await prisma.hourlyAdSlot.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: SLOT_SELECT,
  });

  return {
    slots: slots
      .map(mapSlotPublic)
      .filter((slot): slot is HourlyAdSlotPublic => slot !== null)
      .map((mapped) => {
        const raw = slots.find((s) => s.id === mapped.id)!;
        return {
          ...mapped,
          linkEnabled: raw.linkEnabled,
          linkUrl: raw.linkUrl,
          imageMime: raw.imageMime,
        };
      }),
  };
}

export async function createHourlyAdSlot(input: CreateHourlyAdSlotInput) {
  await ensureHourlyAdDefaults();

  const count = await prisma.hourlyAdSlot.count();
  if (count >= HOURLY_AD_MAX_SLOTS) {
    throw new Error(`광고 슬롯은 최대 ${HOURLY_AD_MAX_SLOTS}개까지 만들 수 있습니다.`);
  }

  const aggregate = await prisma.hourlyAdSlot.aggregate({
    _max: { sortOrder: true },
  });
  const sortOrder = (aggregate._max.sortOrder ?? -1) + 1;
  const id = `ad_${randomUUID().replace(/-/g, "")}`;

  await prisma.hourlyAdSlot.create({
    data: {
      id,
      sortOrder,
      title: input.title,
      offsetMin: input.offsetMin,
      durationMin: input.durationMin ?? HOURLY_AD_DURATION_MIN_DEFAULT,
      defaultImagePath: HOURLY_AD_FALLBACK_IMAGE_PATH,
      active: input.active ?? true,
      linkEnabled: input.linkEnabled ?? false,
      linkUrl: input.linkUrl ?? null,
    },
  });
  await renumberHourlyAdSlots();

  return listHourlyAdsForAdmin();
}

export async function deleteHourlyAdSlot(slotId: HourlyAdSlotId) {
  if (!isHourlyAdSlotId(slotId)) {
    throw new Error("Unknown slot");
  }
  const existing = await prisma.hourlyAdSlot.findUnique({
    where: { id: slotId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Unknown slot");
  }

  await prisma.hourlyAdSlot.delete({ where: { id: slotId } });
  await renumberHourlyAdSlots();
  return listHourlyAdsForAdmin();
}
