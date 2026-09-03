-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "marketingConsentAt" TIMESTAMP(3);

-- Backfill verified timestamps for already-active accounts
UPDATE "User" SET "emailVerifiedAt" = COALESCE("lastLoginAt", "createdAt")
WHERE "status" = 'ACTIVE' AND "email" IS NOT NULL AND "emailVerifiedAt" IS NULL;
