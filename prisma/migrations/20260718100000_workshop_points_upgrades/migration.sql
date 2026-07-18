-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dumpWorkshopPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "crashWorkshopPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hillWorkshopPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gachaTicketsStandard" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gachaTicketsPremium" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserWorkshopUpgrade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "upgradeKey" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWorkshopUpgrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserWorkshopShopPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWorkshopShopPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserWorkshopUpgrade_userId_workshopId_idx" ON "UserWorkshopUpgrade"("userId", "workshopId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserWorkshopUpgrade_userId_workshopId_upgradeKey_key" ON "UserWorkshopUpgrade"("userId", "workshopId", "upgradeKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserWorkshopShopPurchase_userId_workshopId_weekKey_idx" ON "UserWorkshopShopPurchase"("userId", "workshopId", "weekKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserWorkshopShopPurchase_userId_workshopId_itemId_weekKey_key" ON "UserWorkshopShopPurchase"("userId", "workshopId", "itemId", "weekKey");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "UserWorkshopUpgrade" ADD CONSTRAINT "UserWorkshopUpgrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "UserWorkshopShopPurchase" ADD CONSTRAINT "UserWorkshopShopPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
