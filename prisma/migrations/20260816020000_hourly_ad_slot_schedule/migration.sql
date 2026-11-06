-- AlterTable: per-slot schedule
ALTER TABLE "HourlyAdSlot" ADD COLUMN IF NOT EXISTS "offsetMin" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HourlyAdSlot" ADD COLUMN IF NOT EXISTS "durationMin" INTEGER NOT NULL DEFAULT 15;

UPDATE "HourlyAdSlot" SET "offsetMin" = 0,  "durationMin" = 15 WHERE "id" = 'm15';
UPDATE "HourlyAdSlot" SET "offsetMin" = 15, "durationMin" = 15 WHERE "id" = 'm30';
UPDATE "HourlyAdSlot" SET "offsetMin" = 30, "durationMin" = 15 WHERE "id" = 'm45';

-- Drop obsolete global settings singleton
DROP TABLE IF EXISTS "HourlyAdSettings";
