-- Additive promotion redemption lifecycle. Existing rows stay committed.

CREATE TYPE "PromotionRedemptionStatus" AS ENUM ('RESERVED', 'COMMITTED', 'RELEASED');

ALTER TABLE "PromotionRedemption"
  ADD COLUMN "status" "PromotionRedemptionStatus" NOT NULL DEFAULT 'COMMITTED',
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "committedAt" TIMESTAMP(3);

UPDATE "PromotionRedemption" SET "committedAt" = "createdAt" WHERE "committedAt" IS NULL;

ALTER TABLE "PromotionRedemption"
  ADD CONSTRAINT "PromotionRedemption_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PromotionRedemption_promotionId_userId_status_idx" ON "PromotionRedemption"("promotionId", "userId", "status");

ALTER TABLE "PromotionRedemption" ALTER COLUMN "status" SET DEFAULT 'RESERVED';
