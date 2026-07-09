-- Split legacy TRUCK upgrades into dedicated dump-truck upgrade parts.
ALTER TYPE "EquipmentPart" ADD VALUE IF NOT EXISTS 'TRUCK_CAPACITY';
ALTER TYPE "EquipmentPart" ADD VALUE IF NOT EXISTS 'TRUCK_SPEED';

UPDATE "UserEquipmentUpgrade"
SET "part" = 'TRUCK_CAPACITY', "level" = LEAST("level", 10), "updatedAt" = NOW()
WHERE "part" = 'TRUCK';
