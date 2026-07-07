CREATE TYPE "RewardType" AS ENUM ('STAR', 'COUPON');

CREATE TYPE "CouponType" AS ENUM ('YK_PARTS_DISCOUNT', 'EQUIPMENT_RENTAL_DISCOUNT');

CREATE TYPE "EquipmentPart" AS ENUM ('ARM', 'BOOM', 'BUCKET', 'ENGINE');

CREATE TABLE "UserRewardInventory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "gameId" TEXT,
  "type" "RewardType" NOT NULL,
  "amount" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserRewardInventory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserCoupon" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "CouponType" NOT NULL,
  "discountPct" INTEGER NOT NULL,
  "barcodeCode" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserCoupon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserEquipmentUpgrade" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "gameId" TEXT NOT NULL DEFAULT 'yanmar',
  "part" "EquipmentPart" NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserEquipmentUpgrade_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserCoupon_barcodeCode_key" ON "UserCoupon"("barcodeCode");
CREATE INDEX "UserRewardInventory_userId_createdAt_idx" ON "UserRewardInventory"("userId", "createdAt");
CREATE INDEX "UserRewardInventory_userId_type_idx" ON "UserRewardInventory"("userId", "type");
CREATE INDEX "UserCoupon_userId_expiresAt_idx" ON "UserCoupon"("userId", "expiresAt");
CREATE INDEX "UserCoupon_userId_type_idx" ON "UserCoupon"("userId", "type");
CREATE UNIQUE INDEX "UserEquipmentUpgrade_userId_gameId_part_key" ON "UserEquipmentUpgrade"("userId", "gameId", "part");
CREATE INDEX "UserEquipmentUpgrade_userId_gameId_idx" ON "UserEquipmentUpgrade"("userId", "gameId");

ALTER TABLE "UserRewardInventory"
ADD CONSTRAINT "UserRewardInventory_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserCoupon"
ADD CONSTRAINT "UserCoupon_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserEquipmentUpgrade"
ADD CONSTRAINT "UserEquipmentUpgrade_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
