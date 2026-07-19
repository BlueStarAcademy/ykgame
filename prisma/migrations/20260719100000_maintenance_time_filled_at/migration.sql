-- AlterTable
ALTER TABLE "UserRepairState" ADD COLUMN IF NOT EXISTS "engineOilFilledAt" TIMESTAMP(3);
ALTER TABLE "UserRepairState" ADD COLUMN IF NOT EXISTS "engineOilFilterFilledAt" TIMESTAMP(3);

-- Backfill: start timers full for existing rows
UPDATE "UserRepairState"
SET "engineOilFilledAt" = COALESCE("engineOilFilledAt", CURRENT_TIMESTAMP),
    "engineOilFilterFilledAt" = COALESCE("engineOilFilterFilledAt", CURRENT_TIMESTAMP)
WHERE "engineOilFilledAt" IS NULL OR "engineOilFilterFilledAt" IS NULL;
