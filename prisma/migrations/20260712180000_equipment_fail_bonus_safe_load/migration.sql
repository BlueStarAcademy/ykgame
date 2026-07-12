-- Add safe-load upgrade part and per-attempt fail pity bonus.
ALTER TYPE "EquipmentPart" ADD VALUE IF NOT EXISTS 'HILL_SAFE_LOAD';

ALTER TABLE "UserEquipmentUpgrade"
ADD COLUMN IF NOT EXISTS "failBonus" DOUBLE PRECISION NOT NULL DEFAULT 0;
