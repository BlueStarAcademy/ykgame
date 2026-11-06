-- CreateTable
CREATE TABLE "HourlyAdSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "everyMin" INTEGER NOT NULL DEFAULT 15,
    "durationMin" INTEGER NOT NULL DEFAULT 15,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HourlyAdSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HourlyAdSlot" (
    "id" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL DEFAULT '',
    "defaultImagePath" TEXT NOT NULL,
    "imageMime" TEXT,
    "imageData" BYTEA,
    "linkEnabled" BOOLEAN NOT NULL DEFAULT false,
    "linkUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HourlyAdSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HourlyAdSlot_active_sortOrder_idx" ON "HourlyAdSlot"("active", "sortOrder");

-- Seed defaults matching current hard-coded creatives
INSERT INTO "HourlyAdSettings" ("id", "everyMin", "durationMin", "updatedAt")
VALUES ('default', 15, 15, CURRENT_TIMESTAMP);

INSERT INTO "HourlyAdSlot" ("id", "sortOrder", "title", "defaultImagePath", "linkEnabled", "linkUrl", "active", "updatedAt")
VALUES
  ('m15', 0, 'SV10·SV11 출시', '/images/yanmar/ads/sv10-sv11-launch.png', false, NULL, true, CURRENT_TIMESTAMP),
  ('m30', 1, '부품 사전 주문', '/images/yanmar/ads/parts-preorder.png', false, NULL, true, CURRENT_TIMESTAMP),
  ('m45', 2, '존디어 부품 20% 인하', '/images/yanmar/ads/hourly-ad-45.png', false, NULL, true, CURRENT_TIMESTAMP);
