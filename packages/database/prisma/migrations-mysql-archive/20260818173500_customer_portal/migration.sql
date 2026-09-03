-- AlterTable
ALTER TABLE `User` ADD COLUMN `phoneVerifiedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `SavedPassenger` MODIFY `passportNumber` VARCHAR(255) NULL;
