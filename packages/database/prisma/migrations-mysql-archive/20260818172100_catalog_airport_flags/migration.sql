-- AlterTable
ALTER TABLE `Airport` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `isPopular` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `Airport_isActive_isPopular_idx` ON `Airport`(`isActive`, `isPopular`);

-- CreateIndex
CREATE UNIQUE INDEX `City_countryId_name_key` ON `City`(`countryId`, `name`);
