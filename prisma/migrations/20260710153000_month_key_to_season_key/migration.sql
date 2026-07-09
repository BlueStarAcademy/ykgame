-- Convert legacy monthly period keys (2026-07) to quarterly season keys (2026-3).
UPDATE "GameScore"
SET "monthKey" = SUBSTRING("monthKey" FROM 1 FOR 4)
  || '-'
  || (((CAST(SUBSTRING("monthKey" FROM 6 FOR 2) AS INTEGER) - 1) / 3) + 1)::TEXT
WHERE "monthKey" ~ '^\d{4}-(0[1-9]|1[0-2])$';
