-- Monument currency / phase fields (schema drifted ahead of migrations on prod)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "monumentPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "monumentPhase" TEXT NOT NULL DEFAULT 'locked';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "monumentConstructionEndsAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "monumentStarsStored" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "monumentProdUpdatedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "monumentTutorialDone" BOOLEAN NOT NULL DEFAULT false;

-- Workshop upgrade timer column
ALTER TABLE "UserWorkshopUpgrade" ADD COLUMN IF NOT EXISTS "pendingCompletesAt" TIMESTAMP(3);

-- Monument upgrade levels
CREATE TABLE IF NOT EXISTS "UserMonumentUpgrade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "upgradeKey" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "pendingCompletesAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMonumentUpgrade_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserMonumentUpgrade_userId_idx" ON "UserMonumentUpgrade"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserMonumentUpgrade_userId_upgradeKey_key" ON "UserMonumentUpgrade"("userId", "upgradeKey");

DO $$ BEGIN
  ALTER TABLE "UserMonumentUpgrade" ADD CONSTRAINT "UserMonumentUpgrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Monument shop weekly counters
CREATE TABLE IF NOT EXISTS "UserMonumentShopPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMonumentShopPurchase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserMonumentShopPurchase_userId_weekKey_idx" ON "UserMonumentShopPurchase"("userId", "weekKey");
CREATE UNIQUE INDEX IF NOT EXISTS "UserMonumentShopPurchase_userId_itemId_weekKey_key" ON "UserMonumentShopPurchase"("userId", "itemId", "weekKey");

DO $$ BEGIN
  ALTER TABLE "UserMonumentShopPurchase" ADD CONSTRAINT "UserMonumentShopPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
