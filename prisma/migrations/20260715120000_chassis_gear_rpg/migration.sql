-- Chassis / Gear / Gacha / Repair RPG system
CREATE TYPE "ChassisModelId" AS ENUM (
  'SV08_1C', 'SV10', 'SV11', 'ViO12_2A', 'ViO17_1', 'ViO20_6', 'ViO23_6',
  'ViO25_6A', 'ViO35_74', 'ViO35_7A_CJR', 'ViO55_6A', 'ViO80_7', 'SV100_7'
);

CREATE TYPE "GearSlot" AS ENUM (
  'ARM', 'BOOM', 'BLADE', 'BUCKET', 'BREAKER', 'GRAPPLE'
);

CREATE TYPE "ItemGrade" AS ENUM (
  'NORMAL', 'ENHANCED', 'PRECISION', 'MASTER'
);

CREATE TYPE "GachaBanner" AS ENUM ('STANDARD', 'PREMIUM');

CREATE TYPE "RepairBuffKind" AS ENUM ('NONE', 'SMALL', 'LARGE');

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "enhanceCores" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "UserChassisLoadout" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "gameId" TEXT NOT NULL DEFAULT 'yanmar',
  "activeChassisId" "ChassisModelId" NOT NULL DEFAULT 'ViO17_1',
  "ownedChassisIds" JSONB NOT NULL DEFAULT '["ViO17_1"]',
  "migratedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserChassisLoadout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserChassisLoadout_userId_gameId_key"
  ON "UserChassisLoadout"("userId", "gameId");
CREATE INDEX IF NOT EXISTS "UserChassisLoadout_userId_gameId_idx"
  ON "UserChassisLoadout"("userId", "gameId");

CREATE TABLE IF NOT EXISTS "GearItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "gameId" TEXT NOT NULL DEFAULT 'yanmar',
  "slot" "GearSlot" NOT NULL,
  "grade" "ItemGrade" NOT NULL,
  "enhanceLevel" INTEGER NOT NULL DEFAULT 0,
  "failBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "mainOption" JSONB NOT NULL,
  "subOptions" JSONB NOT NULL,
  "masterOption" JSONB,
  "nameSnapshot" TEXT NOT NULL,
  "durability" DOUBLE PRECISION NOT NULL,
  "durabilityMax" DOUBLE PRECISION NOT NULL,
  "equippedSlot" "GearSlot",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GearItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GearItem_userId_gameId_idx" ON "GearItem"("userId", "gameId");
CREATE INDEX IF NOT EXISTS "GearItem_userId_gameId_equippedSlot_idx"
  ON "GearItem"("userId", "gameId", "equippedSlot");

CREATE TABLE IF NOT EXISTS "UserRepairState" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "gameId" TEXT NOT NULL DEFAULT 'yanmar',
  "buffKind" "RepairBuffKind" NOT NULL DEFAULT 'NONE',
  "buffExpiresAt" TIMESTAMP(3),
  "freeRepairAvailableAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserRepairState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserRepairState_userId_gameId_key"
  ON "UserRepairState"("userId", "gameId");
CREATE INDEX IF NOT EXISTS "UserRepairState_userId_gameId_idx"
  ON "UserRepairState"("userId", "gameId");

CREATE TABLE IF NOT EXISTS "GachaPullLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "gameId" TEXT NOT NULL DEFAULT 'yanmar',
  "banner" "GachaBanner" NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "results" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GachaPullLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GachaPullLog_userId_createdAt_idx"
  ON "GachaPullLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "GachaPullLog_gameId_createdAt_idx"
  ON "GachaPullLog"("gameId", "createdAt");

ALTER TABLE "UserChassisLoadout"
  ADD CONSTRAINT "UserChassisLoadout_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GearItem"
  ADD CONSTRAINT "GearItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserRepairState"
  ADD CONSTRAINT "UserRepairState_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GachaPullLog"
  ADD CONSTRAINT "GachaPullLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
