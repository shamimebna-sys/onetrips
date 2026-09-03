-- Payment lookup indexes for reconciliation and webhook matching
CREATE INDEX `Payment_status_createdAt_idx` ON `Payment`(`status`, `createdAt`);
CREATE INDEX `Payment_providerRef_idx` ON `Payment`(`providerRef`);
