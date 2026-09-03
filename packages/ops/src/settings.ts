import { prisma } from "@onetrips/database";
import { DomainError } from "@onetrips/shared";
import { describeNotificationProviders } from "@onetrips/notifications";
import { z } from "zod";

const configSchema = z.object({
  key: z.string().trim().min(2).max(64),
  value: z.string().max(4000),
  dataType: z.enum(["string", "number", "boolean", "json"]).default("string"),
  description: z.string().trim().max(255).optional(),
});

function moneyCurrency(row: { id: string; code: string; name: string; symbol: string; decimalPlaces: number; isActive: boolean }) {
  return row;
}

export async function listCurrencies() {
  const rows = await prisma.currency.findMany({ orderBy: { code: "asc" } });
  return rows.map(moneyCurrency);
}

export async function setCurrencyActive(id: string, isActive: boolean) {
  const existing = await prisma.currency.findUnique({ where: { id } });
  if (!existing) throw new DomainError("CURRENCY_NOT_FOUND", "Currency not found.", 404);
  return moneyCurrency(await prisma.currency.update({ where: { id }, data: { isActive } }));
}

export async function listSystemConfig() {
  return prisma.systemConfig.findMany({ orderBy: { key: "asc" } });
}

export async function upsertSystemConfig(input: unknown, updatedBy?: string) {
  const data = configSchema.parse(input);
  return prisma.systemConfig.upsert({
    where: { key: data.key },
    update: {
      value: data.value,
      dataType: data.dataType,
      description: data.description,
      updatedBy,
    },
    create: {
      key: data.key,
      value: data.value,
      dataType: data.dataType,
      description: data.description,
      updatedBy,
    },
  });
}

export async function getSettingsOverview() {
  const [currencies, config] = await Promise.all([listCurrencies(), listSystemConfig()]);
  const providers = describeNotificationProviders();
  return {
    emailProvider: providers.email,
    smsProvider: providers.sms,
    queueBackend: providers.queue,
    smtpConfigured: providers.smtpConfigured,
    smsConfigured: providers.smsConfigured,
    currencies,
    config: config.map((row) => ({
      id: row.id,
      key: row.key,
      value: row.value,
      dataType: row.dataType,
      description: row.description,
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}
