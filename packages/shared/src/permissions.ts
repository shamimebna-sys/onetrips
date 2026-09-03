export const PERMISSIONS = {
  BOOKING_VIEW: "booking.view",
  BOOKING_CREATE: "booking.create",
  BOOKING_CANCEL: "booking.cancel",
  BOOKING_REFUND: "booking.refund",
  PAYMENT_VIEW: "payment.view",
  PAYMENT_CREATE: "payment.create",
  PAYMENT_REFUND: "payment.refund",
  CUSTOMER_VIEW: "customer.view",
  CUSTOMER_UPDATE: "customer.update",
  B2B_VIEW: "b2b.view",
  B2B_MANAGE: "b2b.manage",
  B2B_CREDIT_MANAGE: "b2b.credit.manage",
  WALLET_VIEW: "wallet.view",
  WALLET_DEPOSIT: "wallet.deposit",
  LEDGER_VIEW: "ledger.view",
  REPORT_VIEW: "report.view",
  REPORT_EXPORT: "report.export",
  MARKUP_MANAGE: "markup.manage",
  USER_MANAGE: "user.manage",
  SETTINGS_MANAGE: "settings.manage",
  AUDIT_VIEW: "audit.view",
  TICKET_ISSUE: "ticket.issue",
  CATALOG_VIEW: "catalog.view",
  CATALOG_MANAGE: "catalog.manage",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PLATFORM_ROLES = [
  "SUPER_ADMIN",
  "OPERATIONS",
  "FINANCE",
  "SUPPORT",
  "SALES",
  "CONFIGURATION_ADMIN",
] as const;

export const B2B_ROLES = [
  "OWNER",
  "ADMIN",
  "AGENT",
  "ACCOUNTANT",
  "VIEWER",
] as const;

export const CUSTOMER_ROLE = "CUSTOMER" as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];
export type B2bRole = (typeof B2B_ROLES)[number];

export const CUSTOMER_PERMISSIONS: PermissionCode[] = [
  PERMISSIONS.BOOKING_VIEW,
  PERMISSIONS.BOOKING_CREATE,
  PERMISSIONS.BOOKING_CANCEL,
  PERMISSIONS.PAYMENT_VIEW,
  PERMISSIONS.PAYMENT_CREATE,
  PERMISSIONS.CUSTOMER_UPDATE,
  PERMISSIONS.WALLET_VIEW,
];
