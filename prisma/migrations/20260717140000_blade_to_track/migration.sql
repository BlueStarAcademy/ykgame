-- Rename gear slot BLADE → TRACK
ALTER TYPE "GearSlot" RENAME VALUE 'BLADE' TO 'TRACK';

-- TRACK items: main option endurance → agility (movement speed)
UPDATE "GearItem"
SET "mainOption" = jsonb_set("mainOption", '{key}', '"agility"'::jsonb)
WHERE "slot" = 'TRACK'
  AND ("mainOption"->>'key') = 'endurance';

-- ARM items: main option agility → endurance
UPDATE "GearItem"
SET "mainOption" = jsonb_set("mainOption", '{key}', '"endurance"'::jsonb)
WHERE "slot" = 'ARM'
  AND ("mainOption"->>'key') = 'agility';

-- Rename blade → track in display names
UPDATE "GearItem"
SET "nameSnapshot" = replace("nameSnapshot", '블레이드', '트랙')
WHERE "nameSnapshot" LIKE '%블레이드%';
