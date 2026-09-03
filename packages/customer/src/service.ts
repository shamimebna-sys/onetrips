import { prisma } from "@onetrips/database";
import { DomainError } from "@onetrips/shared";
import { changePassword, consumeOtp, issueOtp } from "@onetrips/auth";
import { decryptSecret, encryptSecret, maskPassport } from "./secret";
import { passengerWriteSchema, phoneOtpSchema, phoneVerifySchema, preferenceUpdateSchema, profileUpdateSchema } from "./schemas";

const MAX_PASSENGERS = 20;

function ageYears(isoDate: string) {
  const dob = new Date(`${isoDate}T00:00:00Z`);
  const now = new Date();
  let years = now.getUTCFullYear() - dob.getUTCFullYear();
  const month = now.getUTCMonth() - dob.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < dob.getUTCDate())) years -= 1;
  return years;
}

function assertAge(type: "ADULT" | "CHILD" | "INFANT", dob?: string) {
  if (!dob) return;
  if (new Date(`${dob}T00:00:00Z`) > new Date()) {
    throw new DomainError("INVALID_DOB", "Date of birth cannot be in the future.");
  }
  const years = ageYears(dob);
  if (type === "INFANT" && years >= 2) {
    throw new DomainError("INVALID_AGE", "Infants must be under 2 years.");
  }
  if (type === "CHILD" && (years < 2 || years >= 12)) {
    throw new DomainError("INVALID_AGE", "Children must be 2–11 years.");
  }
  if (type === "ADULT" && years < 12) {
    throw new DomainError("INVALID_AGE", "Adults must be 12 or older.");
  }
}

async function requireCustomerRecord(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { customer: true },
  });
  if (!user || user.type !== "CUSTOMER" || user.deletedAt) {
    throw new DomainError("FORBIDDEN", "Customer account required.", 403);
  }
  if (user.customer) return { user, customer: user.customer };

  const [firstName, ...rest] = (user.displayName ?? "Traveler").split(" ");
  const customer = await prisma.customer.create({
    data: {
      userId: user.id,
      firstName: firstName || "Traveler",
      lastName: rest.join(" ") || firstName || "Account",
    },
  });
  return { user, customer };
}

function toDate(value?: string) {
  return value ? new Date(`${value}T00:00:00Z`) : null;
}

function isoDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export async function getProfile(userId: string) {
  const { user, customer } = await requireCustomerRecord(userId);
  const travelerCount = await prisma.savedPassenger.count({ where: { customerId: customer.id } });
  return {
    userId: user.id,
    email: user.email,
    phone: user.phone,
    phoneVerified: Boolean(user.phoneVerifiedAt),
    firstName: customer.firstName,
    lastName: customer.lastName,
    dateOfBirth: isoDate(customer.dateOfBirth),
    gender: customer.gender,
    nationality: customer.nationalityId,
    addressLine1: customer.addressLine1 ?? "",
    addressLine2: customer.addressLine2 ?? "",
    city: customer.city ?? "",
    postalCode: customer.postalCode ?? "",
    countryId: customer.countryId ?? "",
    photoUrl: customer.photoUrl ? "/api/account/photo" : null,
    marketingConsentAt: customer.marketingConsentAt?.toISOString() ?? null,
    travelerCount,
  };
}

export async function updateProfile(userId: string, input: unknown) {
  const data = profileUpdateSchema.parse(input);
  if (data.dateOfBirth) assertAge("ADULT", data.dateOfBirth);
  const { customer } = await requireCustomerRecord(userId);

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: customer.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: toDate(data.dateOfBirth || undefined),
        gender: data.gender ?? null,
        nationalityId: data.nationality || null,
        addressLine1: data.addressLine1 || null,
        addressLine2: data.addressLine2 || null,
        city: data.city || null,
        postalCode: data.postalCode || null,
        countryId: data.countryId || null,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { displayName: `${data.firstName} ${data.lastName}` },
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      actorType: "CUSTOMER",
      action: "customer.profile.update",
      entityType: "Customer",
      entityId: customer.id,
    },
  });

  return getProfile(userId);
}

export async function updatePassword(userId: string, input: unknown) {
  await requireCustomerRecord(userId);
  await changePassword(userId, input);
  return { message: "Password updated." };
}

export async function requestPhoneOtp(userId: string, input: unknown) {
  const data = phoneOtpSchema.parse(input);
  await requireCustomerRecord(userId);
  const taken = await prisma.user.findFirst({
    where: { phone: data.phone, NOT: { id: userId } },
  });
  if (taken) {
    throw new DomainError("PHONE_TAKEN", "That phone number is already in use.", 409);
  }
  return issueOtp({
    destination: data.phone,
    channel: "SMS",
    purpose: "PHONE_VERIFY",
  });
}

export async function verifyPhone(userId: string, input: unknown) {
  const data = phoneVerifySchema.parse(input);
  await requireCustomerRecord(userId);
  await consumeOtp(data.phone, "PHONE_VERIFY", data.code);
  await prisma.user.update({
    where: { id: userId },
    data: { phone: data.phone, phoneVerifiedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      actorId: userId,
      actorType: "CUSTOMER",
      action: "customer.phone.verify",
      entityType: "User",
      entityId: userId,
    },
  });
  return getProfile(userId);
}

export async function listPassengers(userId: string) {
  const { customer } = await requireCustomerRecord(userId);
  const rows = await prisma.savedPassenger.findMany({
    where: { customerId: customer.id },
    orderBy: [{ isPreferred: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    firstName: row.firstName,
    lastName: row.lastName,
    nationality: row.nationality,
    dateOfBirth: isoDate(row.dateOfBirth),
    passportExpiry: isoDate(row.passportExpiry),
    passportNumberMasked: maskPassport(row.passportNumber),
    isPreferred: row.isPreferred,
    frequentFlyerNumber: row.frequentFlyerNumber,
    passportExpiringSoon: row.passportExpiry
      ? row.passportExpiry.getTime() - Date.now() < 180 * 24 * 60 * 60 * 1000
      : false,
  }));
}

export async function getPassenger(userId: string, passengerId: string) {
  const { customer } = await requireCustomerRecord(userId);
  const row = await prisma.savedPassenger.findFirst({
    where: { id: passengerId, customerId: customer.id },
  });
  if (!row) throw new DomainError("PASSENGER_NOT_FOUND", "Traveler not found.", 404);
  return {
    id: row.id,
    type: row.type,
    firstName: row.firstName,
    lastName: row.lastName,
    nationality: row.nationality,
    dateOfBirth: isoDate(row.dateOfBirth),
    passportExpiry: isoDate(row.passportExpiry),
    passportNumber: row.passportNumber ? decryptSecret(row.passportNumber) : "",
    isPreferred: row.isPreferred,
    frequentFlyerNumber: row.frequentFlyerNumber ?? "",
  };
}

async function markPreferred(customerId: string, passengerId: string) {
  await prisma.$transaction([
    prisma.savedPassenger.updateMany({ where: { customerId }, data: { isPreferred: false } }),
    prisma.savedPassenger.update({ where: { id: passengerId }, data: { isPreferred: true } }),
  ]);
}

export async function createPassenger(userId: string, input: unknown) {
  const data = passengerWriteSchema.parse(input);
  if (data.dateOfBirth) assertAge(data.type, data.dateOfBirth);
  if (data.passportExpiry && new Date(`${data.passportExpiry}T00:00:00Z`) < new Date()) {
    throw new DomainError("PASSPORT_EXPIRED", "Passport expiry must be in the future.");
  }
  const { customer } = await requireCustomerRecord(userId);
  const count = await prisma.savedPassenger.count({ where: { customerId: customer.id } });
  if (count >= MAX_PASSENGERS) {
    throw new DomainError("PASSENGER_LIMIT", `You can save up to ${MAX_PASSENGERS} travelers.`);
  }

  const created = await prisma.savedPassenger.create({
    data: {
      customerId: customer.id,
      type: data.type,
      firstName: data.firstName,
      lastName: data.lastName,
      nationality: data.nationality || null,
      dateOfBirth: toDate(data.dateOfBirth || undefined),
      passportExpiry: toDate(data.passportExpiry || undefined),
      passportNumber: data.passportNumber ? encryptSecret(data.passportNumber.toUpperCase()) : null,
      frequentFlyerNumber: data.frequentFlyerNumber || null,
      isPreferred: Boolean(data.isPreferred),
    },
  });
  if (data.isPreferred) await markPreferred(customer.id, created.id);
  return getPassenger(userId, created.id);
}

export async function updatePassenger(userId: string, passengerId: string, input: unknown) {
  const data = passengerWriteSchema.partial().parse(input);
  const { customer } = await requireCustomerRecord(userId);
  const existing = await prisma.savedPassenger.findFirst({
    where: { id: passengerId, customerId: customer.id },
  });
  if (!existing) throw new DomainError("PASSENGER_NOT_FOUND", "Traveler not found.", 404);

  const nextType = data.type ?? existing.type;
  if (data.dateOfBirth) assertAge(nextType, data.dateOfBirth);
  if (data.passportExpiry && new Date(`${data.passportExpiry}T00:00:00Z`) < new Date()) {
    throw new DomainError("PASSPORT_EXPIRED", "Passport expiry must be in the future.");
  }

  await prisma.savedPassenger.update({
    where: { id: passengerId },
    data: {
      type: data.type,
      firstName: data.firstName,
      lastName: data.lastName,
      nationality: data.nationality === "" ? null : data.nationality,
      dateOfBirth: data.dateOfBirth === undefined ? undefined : toDate(data.dateOfBirth || undefined),
      passportExpiry: data.passportExpiry === undefined ? undefined : toDate(data.passportExpiry || undefined),
      passportNumber:
        data.passportNumber === undefined
          ? undefined
          : data.passportNumber
            ? encryptSecret(data.passportNumber.toUpperCase())
            : null,
      frequentFlyerNumber: data.frequentFlyerNumber === undefined ? undefined : data.frequentFlyerNumber || null,
      isPreferred: data.isPreferred,
    },
  });
  if (data.isPreferred) await markPreferred(customer.id, passengerId);
  return getPassenger(userId, passengerId);
}

export async function deletePassenger(userId: string, passengerId: string) {
  const { customer } = await requireCustomerRecord(userId);
  const existing = await prisma.savedPassenger.findFirst({
    where: { id: passengerId, customerId: customer.id },
  });
  if (!existing) throw new DomainError("PASSENGER_NOT_FOUND", "Traveler not found.", 404);
  await prisma.savedPassenger.delete({ where: { id: passengerId } });
  return { message: "Traveler removed." };
}

export async function getPreference(userId: string) {
  const { customer } = await requireCustomerRecord(userId);
  const preference = await prisma.customerPreference.findUnique({ where: { customerId: customer.id } });
  return (
    preference ?? {
      locale: "en",
      currency: "BDT",
      emailOptIn: true,
      smsOptIn: true,
      marketingOptIn: Boolean(customer.marketingConsentAt),
    }
  );
}

export async function updatePreference(userId: string, input: unknown) {
  const data = preferenceUpdateSchema.parse(input);
  const { customer } = await requireCustomerRecord(userId);
  const preference = await prisma.customerPreference.upsert({
    where: { customerId: customer.id },
    update: data,
    create: { customerId: customer.id, ...data },
  });
  if (data.marketingOptIn && !customer.marketingConsentAt) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { marketingConsentAt: new Date() },
    });
  }
  return preference;
}

export async function setCustomerPhoto(userId: string, filename: string) {
  const { customer } = await requireCustomerRecord(userId);
  await prisma.customer.update({
    where: { id: customer.id },
    data: { photoUrl: filename },
  });
  return getProfile(userId);
}

export async function getCustomerPhotoFilename(userId: string) {
  const { customer } = await requireCustomerRecord(userId);
  return customer.photoUrl;
}
