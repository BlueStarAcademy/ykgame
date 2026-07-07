CREATE TABLE "UserMail" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "currencyAmount" INTEGER NOT NULL DEFAULT 0,
  "couponType" "CouponType",
  "couponDiscountPct" INTEGER,
  "readAt" TIMESTAMP(3),
  "claimedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserMail_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserMail_userId_createdAt_idx" ON "UserMail"("userId", "createdAt");
CREATE INDEX "UserMail_userId_claimedAt_idx" ON "UserMail"("userId", "claimedAt");

ALTER TABLE "UserMail"
ADD CONSTRAINT "UserMail_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
