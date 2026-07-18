-- Ensure column exists (must run before any ALTER of this column).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gearInventorySlots" INTEGER NOT NULL DEFAULT 40;

-- AlterTable: new accounts start at 40 slots
ALTER TABLE "User" ALTER COLUMN "gearInventorySlots" SET DEFAULT 40;

-- Reset existing inventory capacity to the new base
UPDATE "User" SET "gearInventorySlots" = 40;
