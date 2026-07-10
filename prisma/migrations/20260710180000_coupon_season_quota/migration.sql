-- AlterTable
ALTER TABLE "UserCoupon" ADD COLUMN "seasonKey" TEXT;
ALTER TABLE "UserCoupon" ADD COLUMN "fromGameDrop" BOOLEAN NOT NULL DEFAULT true;

-- Backfill seasonKey from createdAt (KST quarterly seasons)
UPDATE "UserCoupon"
SET "seasonKey" = (
  EXTRACT(YEAR FROM ("createdAt" AT TIME ZONE 'Asia/Seoul'))::TEXT
  || '-'
  || (
    FLOOR(
      (EXTRACT(MONTH FROM ("createdAt" AT TIME ZONE 'Asia/Seoul')) - 1) / 3
    )::INT
    + 1
  )::TEXT
)
WHERE "seasonKey" IS NULL;

ALTER TABLE "UserCoupon" ALTER COLUMN "seasonKey" SET NOT NULL;

-- CreateIndex
CREATE INDEX "UserCoupon_seasonKey_type_fromGameDrop_idx" ON "UserCoupon"("seasonKey", "type", "fromGameDrop");
