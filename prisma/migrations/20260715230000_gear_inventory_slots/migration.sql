-- Expandable yanmar gear inventory capacity (base 60, max 200).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gearInventorySlots" INTEGER NOT NULL DEFAULT 60;
