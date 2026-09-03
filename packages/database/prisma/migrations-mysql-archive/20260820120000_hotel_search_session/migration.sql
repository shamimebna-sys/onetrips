-- CreateTable
CREATE TABLE `HotelSearchSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `sessionToken` VARCHAR(191) NOT NULL,
    `searchParams` JSON NOT NULL,
    `providerIds` JSON NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `HotelSearchSession_sessionToken_key`(`sessionToken`),
    INDEX `HotelSearchSession_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
