-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "InquiryStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomerInquiry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'OPEN',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerInquiry_createdAt_idx" ON "CustomerInquiry"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerInquiry_status_createdAt_idx" ON "CustomerInquiry"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerInquiry_userId_createdAt_idx" ON "CustomerInquiry"("userId", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CustomerInquiry" ADD CONSTRAINT "CustomerInquiry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
