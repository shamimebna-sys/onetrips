import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CUSTOMER_PERMISSIONS, CUSTOMER_ROLE, PERMISSIONS, PLATFORM_ROLES, B2B_ROLES } from "@onetrips/shared";
import { seedCatalog } from "./seed-catalog";

const prisma = new PrismaClient();

const permissionSeed = [
  { code: PERMISSIONS.BOOKING_VIEW, description: "View bookings", category: "booking" },
  { code: PERMISSIONS.BOOKING_CREATE, description: "Create bookings", category: "booking" },
  { code: PERMISSIONS.BOOKING_CANCEL, description: "Cancel bookings", category: "booking" },
  { code: PERMISSIONS.BOOKING_REFUND, description: "Refund bookings", category: "booking" },
  { code: PERMISSIONS.PAYMENT_VIEW, description: "View payments", category: "payment" },
  { code: PERMISSIONS.PAYMENT_CREATE, description: "Create payments", category: "payment" },
  { code: PERMISSIONS.PAYMENT_REFUND, description: "Refund payments", category: "payment" },
  { code: PERMISSIONS.CUSTOMER_VIEW, description: "View customers", category: "customer" },
  { code: PERMISSIONS.CUSTOMER_UPDATE, description: "Update customers", category: "customer" },
  { code: PERMISSIONS.B2B_VIEW, description: "View B2B organizations", category: "b2b" },
  { code: PERMISSIONS.B2B_MANAGE, description: "Manage B2B organizations", category: "b2b" },
  { code: PERMISSIONS.B2B_CREDIT_MANAGE, description: "Manage B2B credit", category: "b2b" },
  { code: PERMISSIONS.WALLET_VIEW, description: "View wallets", category: "finance" },
  { code: PERMISSIONS.WALLET_DEPOSIT, description: "Deposit to wallets", category: "finance" },
  { code: PERMISSIONS.LEDGER_VIEW, description: "View ledger", category: "finance" },
  { code: PERMISSIONS.REPORT_VIEW, description: "View reports", category: "report" },
  { code: PERMISSIONS.REPORT_EXPORT, description: "Export reports", category: "report" },
  { code: PERMISSIONS.MARKUP_MANAGE, description: "Manage markup rules", category: "pricing" },
  { code: PERMISSIONS.USER_MANAGE, description: "Manage users and roles", category: "identity" },
  { code: PERMISSIONS.SETTINGS_MANAGE, description: "Manage system settings", category: "admin" },
  { code: PERMISSIONS.AUDIT_VIEW, description: "View audit logs", category: "admin" },
  { code: PERMISSIONS.TICKET_ISSUE, description: "Issue tickets", category: "ticketing" },
  { code: PERMISSIONS.CATALOG_VIEW, description: "View catalog", category: "catalog" },
  { code: PERMISSIONS.CATALOG_MANAGE, description: "Manage catalog", category: "catalog" },
];

const platformRolePermissions: Record<string, string[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS),
  OPERATIONS: [
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.BOOKING_CREATE,
    PERMISSIONS.BOOKING_CANCEL,
    PERMISSIONS.BOOKING_REFUND,
    PERMISSIONS.TICKET_ISSUE,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.B2B_VIEW,
    PERMISSIONS.WALLET_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.CATALOG_VIEW,
  ],
  FINANCE: [
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.BOOKING_REFUND,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_REFUND,
    PERMISSIONS.B2B_VIEW,
    PERMISSIONS.B2B_CREDIT_MANAGE,
    PERMISSIONS.WALLET_VIEW,
    PERMISSIONS.WALLET_DEPOSIT,
    PERMISSIONS.LEDGER_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.MARKUP_MANAGE,
  ],
  SUPPORT: [
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_UPDATE,
  ],
  SALES: [
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.B2B_VIEW,
    PERMISSIONS.B2B_MANAGE,
    PERMISSIONS.MARKUP_MANAGE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.CATALOG_VIEW,
  ],
  CONFIGURATION_ADMIN: [
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.CATALOG_VIEW,
    PERMISSIONS.CATALOG_MANAGE,
  ],
};

const b2bRolePermissions: Record<string, string[]> = {
  OWNER: [
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.BOOKING_CREATE,
    PERMISSIONS.BOOKING_CANCEL,
    PERMISSIONS.BOOKING_REFUND,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.WALLET_VIEW,
    PERMISSIONS.WALLET_DEPOSIT,
    PERMISSIONS.LEDGER_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.USER_MANAGE,
  ],
  ADMIN: [
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.BOOKING_CREATE,
    PERMISSIONS.BOOKING_CANCEL,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.WALLET_VIEW,
    PERMISSIONS.LEDGER_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.USER_MANAGE,
  ],
  AGENT: [
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.BOOKING_CREATE,
    PERMISSIONS.BOOKING_CANCEL,
  ],
  ACCOUNTANT: [
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.WALLET_VIEW,
    PERMISSIONS.LEDGER_VIEW,
    PERMISSIONS.REPORT_VIEW,
  ],
  VIEWER: [PERMISSIONS.BOOKING_VIEW],
};

async function main() {
  for (const permission of permissionSeed) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: permission,
      create: permission,
    });
  }

  const allPermissions = await prisma.permission.findMany();
  const byCode = Object.fromEntries(allPermissions.map((p) => [p.code, p.id]));

  async function seedRole(
    name: string,
    scope: "PLATFORM" | "B2B" | "CUSTOMER",
    codes: string[],
  ) {
    const role = await prisma.role.upsert({
      where: { name },
      update: { scope },
      create: { name, scope, description: `${scope} role ${name}` },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: codes
        .filter((code) => byCode[code])
        .map((code) => ({ roleId: role.id, permissionId: byCode[code] })),
    });
  }

  for (const name of PLATFORM_ROLES) {
    await seedRole(name, "PLATFORM", platformRolePermissions[name] ?? []);
  }
  for (const name of B2B_ROLES) {
    await seedRole(`B2B_${name}`, "B2B", b2bRolePermissions[name] ?? []);
  }
  await seedRole(CUSTOMER_ROLE, "CUSTOMER", CUSTOMER_PERMISSIONS);

  const currencies = [
    { code: "BDT", name: "Bangladeshi Taka", symbol: "৳" },
    { code: "USD", name: "US Dollar", symbol: "$" },
    { code: "EUR", name: "Euro", symbol: "€" },
    { code: "GBP", name: "British Pound", symbol: "£" },
    { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
    { code: "SAR", name: "Saudi Riyal", symbol: "﷼" },
    { code: "INR", name: "Indian Rupee", symbol: "₹" },
  ];

  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: currency,
      create: currency,
    });
  }

  const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.toLowerCase();
  const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (adminEmail && adminPassword) {
    const superAdmin = await prisma.role.findUnique({ where: { name: "SUPER_ADMIN" } });
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existing && superAdmin) {
      const admin = await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: await bcrypt.hash(adminPassword, 12),
          displayName: "Super Admin",
          type: "ADMIN",
          status: "ACTIVE",
          mfaEnabled: true,
        },
      });
      await prisma.userRole.create({
        data: { userId: admin.id, roleId: superAdmin.id },
      });
      console.log(`Seeded admin user ${adminEmail}`);
    }
  } else {
    console.log("Skipping admin bootstrap (set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD).");
  }

  await seedCatalog(prisma);
  const notifyTemplates = [
    {
      name: "ETICKET",
      channel: "EMAIL" as const,
      subject: "Your ONETRIPS e-ticket — {{bookingRef}}",
      body: "Your flight is ticketed.\n\nBooking {{bookingRef}}\nPNR {{pnr}}\nTicket numbers: {{ticketNumbers}}\n\nThe e-ticket PDFs are attached.\n\nONETRIPS",
      variables: ["bookingRef", "pnr", "ticketNumbers"],
    },
    {
      name: "OTP",
      channel: "EMAIL" as const,
      subject: "Your ONETRIPS verification code",
      body: "Your verification code is {{code}}.\n\nPurpose: {{purpose}}\nIt expires in 10 minutes.\n\nONETRIPS",
      variables: ["code", "purpose"],
    },
    {
      name: "PAYMENT_SUCCESS",
      channel: "EMAIL" as const,
      subject: "Payment received — {{bookingRef}}",
      body: "We received {{currency}} {{amount}} for booking {{bookingRef}}.\n\nYour tickets will follow shortly.\n\nONETRIPS",
      variables: ["bookingRef", "amount", "currency"],
    },
    {
      name: "SMS_OTP",
      channel: "SMS" as const,
      subject: null,
      body: "ONETRIPS code {{code}} ({{purpose}}). Valid 10 min.",
      variables: ["code", "purpose"],
    },
    {
      name: "SMS_TICKETED",
      channel: "SMS" as const,
      subject: null,
      body: "ONETRIPS: booking {{bookingRef}} is ticketed. PNR {{pnr}}. Check email for PDFs.",
      variables: ["bookingRef", "pnr"],
    },
    {
      name: "BOOKING_CANCELLED",
      channel: "EMAIL" as const,
      subject: "Booking cancelled — {{bookingRef}}",
      body: "Booking {{bookingRef}} has been cancelled.\n\nIf a payment was captured, the refund will follow.\n\nONETRIPS",
      variables: ["bookingRef", "status", "amount", "currency"],
    },
    {
      name: "BOOKING_REFUNDED",
      channel: "EMAIL" as const,
      subject: "Refund completed — {{bookingRef}}",
      body: "We refunded {{currency}} {{amount}} for booking {{bookingRef}}.\n\nONETRIPS",
      variables: ["bookingRef", "amount", "currency", "refunded"],
    },
    {
      name: "SMS_CANCELLED",
      channel: "SMS" as const,
      subject: null,
      body: "ONETRIPS: booking {{bookingRef}} was cancelled ({{status}}).",
      variables: ["bookingRef", "status"],
    },
    {
      name: "SUPPORT_ACK",
      channel: "EMAIL" as const,
      subject: "We received your support request",
      body: "Thanks for contacting ONETRIPS.\n\nWe received “{{subject}}” ({{requestId}}). A specialist will reply in your account inbox.\n\nONETRIPS",
      variables: ["subject", "requestId"],
    },
    {
      name: "SUPPORT_UPDATE",
      channel: "EMAIL" as const,
      subject: "Support update — {{subject}}",
      body: "There is an update on your support request {{requestId}}.\n\nStatus: {{status}}\n\nSign in to ONETRIPS to read the reply.\n\nONETRIPS",
      variables: ["subject", "requestId", "status"],
    },
  ];
  for (const template of notifyTemplates) {
    await prisma.notificationTemplate.upsert({
      where: { name: template.name },
      update: { subject: template.subject, body: template.body, channel: template.channel, variables: template.variables },
      create: template,
    });
  }
  const agencyEmail = process.env.B2B_BOOTSTRAP_EMAIL?.toLowerCase();
  const agencyPassword = process.env.B2B_BOOTSTRAP_PASSWORD;
  if (agencyEmail && agencyPassword) {
    const ownerRole = await prisma.role.findUnique({ where: { name: "B2B_OWNER" } });
    const existingUser = await prisma.user.findUnique({ where: { email: agencyEmail } });
    if (!existingUser && ownerRole) {
      const user = await prisma.user.create({
        data: {
          email: agencyEmail,
          passwordHash: await bcrypt.hash(agencyPassword, 12),
          displayName: "Demo Agency Owner",
          type: "B2B",
          status: "ACTIVE",
        },
      });
      const organization = await prisma.organization.create({
        data: {
          name: "ONETRIPS Demo Agency",
          type: "AGENCY",
          status: "ACTIVE",
          country: "Bangladesh",
          city: "Dhaka",
          creditLimit: 100000,
        },
      });
      await prisma.organizationUser.create({
        data: { organizationId: organization.id, userId: user.id, role: "OWNER" },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: ownerRole.id, organizationId: organization.id },
      });
      const wallet = await prisma.wallet.create({
        data: { ownerId: organization.id, ownerType: "ORGANIZATION", currency: "BDT", status: "ACTIVE" },
      });
      await prisma.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          type: "DEPOSIT",
          amount: 25000,
          currency: "BDT",
          reference: `SEED-${organization.id.slice(-8)}`,
          actorId: user.id,
          note: "Seeded working capital",
        },
      });
      console.log(`Seeded B2B agency ${agencyEmail} with ৳25,000 wallet and ৳100,000 credit`);
    }
  } else {
    console.log("Skipping B2B bootstrap (set B2B_BOOTSTRAP_EMAIL and B2B_BOOTSTRAP_PASSWORD).");
  }

  if ((await prisma.markupRule.count()) === 0) {
    await prisma.markupRule.createMany({
      data: [
        { appliesTo: "B2C", markupType: "PERCENT", markupValue: 5, currency: "BDT", priority: 0, status: "ACTIVE" },
        { appliesTo: "B2B", markupType: "PERCENT", markupValue: 3, currency: "BDT", priority: 0, status: "ACTIVE" },
      ],
    });
    console.log("Seeded default B2C 5% and B2B 3% markup rules.");
  }
  if ((await prisma.serviceFeeRule.count()) === 0) {
    await prisma.serviceFeeRule.createMany({
      data: [
        { name: "B2C booking fee", amount: 300, type: "FLAT", appliesTo: "B2C", status: "ACTIVE" },
        { name: "B2B booking fee", amount: 150, type: "FLAT", appliesTo: "B2B", status: "ACTIVE" },
      ],
    });
    console.log("Seeded default service fees (B2C ৳300, B2B ৳150).");
  }
  if ((await prisma.commissionRule.count()) === 0) {
    await prisma.commissionRule.create({
      data: { commissionType: "PERCENT", commissionValue: 2, status: "ACTIVE" },
    });
    console.log("Seeded default 2% B2B commission rule.");
  }

  const configs = [
    { key: "BOOKING_HOLD_MINUTES", value: "20", dataType: "number", description: "Customer fare hold after selection" },
    { key: "INVOICE_DUE_DAYS", value: "7", dataType: "number", description: "Invoice due date offset" },
    { key: "SUPPORT_EMAIL", value: "support@onetrips.local", dataType: "string", description: "Operations contact email" },
  ];
  for (const row of configs) {
    await prisma.systemConfig.upsert({
      where: { key: row.key },
      update: {},
      create: row,
    });
  }

  const now = new Date();
  await prisma.promotion.upsert({
    where: { code: "SAVE10" },
    update: {},
    create: {
      code: "SAVE10",
      name: "Save 10% on flights",
      description: "10% off B2C flight bookings, up to ৳1,500.",
      percentOff: 10,
      maxDiscount: 1500,
      currency: "BDT",
      startsAt: now,
      endsAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
      perCustomerLimit: 5,
      flightEligible: true,
      hotelEligible: false,
      status: "ACTIVE",
    },
  });

  console.log("Seed complete: roles, permissions, currencies, catalog, notification templates, pricing, settings.");

  if (process.env.NODE_ENV !== "production") {
    const customerRole = await prisma.role.findUnique({ where: { name: "CUSTOMER" } });
    const e2eAccounts = [
      {
        email: (process.env.E2E_CUSTOMER_EMAIL || "e2e.customer@onetrips.test").toLowerCase(),
        password: process.env.E2E_CUSTOMER_PASSWORD || "E2eCustomer#14D",
        firstName: "E2E",
        lastName: "Customer",
        phone: "01700000014",
      },
      {
        email: (process.env.E2E_CUSTOMER_B_EMAIL || "e2e.customer.b@onetrips.test").toLowerCase(),
        password: process.env.E2E_CUSTOMER_B_PASSWORD || "E2eCustomerB#14D",
        firstName: "E2E",
        lastName: "Other",
        phone: "01700000015",
      },
    ];
    for (const account of e2eAccounts) {
      const existing = await prisma.user.findUnique({ where: { email: account.email } });
      if (existing || !customerRole) continue;
      const user = await prisma.user.create({
        data: {
          email: account.email,
          phone: account.phone,
          passwordHash: await bcrypt.hash(account.password, 12),
          displayName: `${account.firstName} ${account.lastName}`,
          type: "CUSTOMER",
          status: "ACTIVE",
        },
      });
      await prisma.customer.create({
        data: { userId: user.id, firstName: account.firstName, lastName: account.lastName },
      });
      await prisma.userRole.create({ data: { userId: user.id, roleId: customerRole.id } });
      console.log(`Seeded E2E customer ${account.email}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
