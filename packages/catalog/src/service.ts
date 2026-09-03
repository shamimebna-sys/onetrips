import { prisma } from "@onetrips/database";
import { DomainError } from "@onetrips/shared";
import {
  airlineWriteSchema,
  airportSearchSchema,
  airportWriteSchema,
  cityWriteSchema,
  countryWriteSchema,
  supplierWriteSchema,
} from "./schemas";
import { filterAndRankAirports, tokenizeAirportQuery } from "./airport-search";

export type AirportView = {
  id: string;
  iataCode: string;
  name: string;
  timezone: string;
  isActive: boolean;
  isPopular: boolean;
  city: { id: string; name: string; country: { id: string; code: string; name: string } };
};

function toAirportView(airport: {
  id: string;
  iataCode: string;
  name: string;
  timezone: string;
  isActive: boolean;
  isPopular: boolean;
  city: { id: string; name: string; country: { id: string; code: string; name: string } };
}): AirportView {
  return airport;
}

function airportTokenWhere(token: string) {
  return {
    OR: [
      { iataCode: { contains: token, mode: "insensitive" as const } },
      { name: { contains: token, mode: "insensitive" as const } },
      { city: { name: { contains: token, mode: "insensitive" as const } } },
      { city: { code: { contains: token, mode: "insensitive" as const } } },
      { city: { country: { name: { contains: token, mode: "insensitive" as const } } } },
      { city: { country: { code: { contains: token, mode: "insensitive" as const } } } },
    ],
  };
}

export async function searchAirports(input: { q?: string; limit?: number; includeInactive?: boolean }) {
  const parsed = airportSearchSchema.parse({ q: input.q, limit: input.limit });
  const q = parsed.q;
  const take = parsed.limit ?? 20;
  const tokens = q ? tokenizeAirportQuery(q) : [];

  const include = { city: { include: { country: true } } } as const;
  const takeCandidates = tokens.length ? Math.min(200, Math.max(take * 8, 50)) : take;
  let rows = await prisma.airport.findMany({
    where: {
      ...(input.includeInactive ? {} : { isActive: true }),
      ...(tokens.length ? { AND: tokens.map(airportTokenWhere) } : {}),
    },
    include,
    orderBy: [{ isPopular: "desc" }, { iataCode: "asc" }],
    take: takeCandidates,
  });

  if (q && rows.length === 0) {
    rows = await prisma.airport.findMany({
      where: input.includeInactive ? {} : { isActive: true },
      include,
      orderBy: [{ isPopular: "desc" }, { iataCode: "asc" }],
      take: 200,
    });
  }

  const views = rows.map(toAirportView);
  if (!q) return views;
  return filterAndRankAirports(views, q, take);
}

export async function listAirports() {
  return prisma.airport.findMany({
    include: { city: { include: { country: true } } },
    orderBy: [{ isPopular: "desc" }, { iataCode: "asc" }],
  });
}

export async function createAirport(input: unknown) {
  const data = airportWriteSchema.parse(input);
  const city = await prisma.city.findUnique({ where: { id: data.cityId } });
  if (!city) throw new DomainError("CITY_NOT_FOUND", "City not found.", 404);

  const existing = await prisma.airport.findUnique({ where: { iataCode: data.iataCode } });
  if (existing) throw new DomainError("AIRPORT_EXISTS", "IATA code already exists.", 409);

  return prisma.airport.create({
    data: {
      iataCode: data.iataCode,
      name: data.name,
      cityId: data.cityId,
      timezone: data.timezone,
      isActive: data.isActive ?? true,
      isPopular: data.isPopular ?? false,
    },
    include: { city: { include: { country: true } } },
  });
}

export async function updateAirport(id: string, input: unknown) {
  const data = airportWriteSchema.partial().parse(input);
  const airport = await prisma.airport.findUnique({ where: { id } });
  if (!airport) throw new DomainError("AIRPORT_NOT_FOUND", "Airport not found.", 404);

  if (data.iataCode && data.iataCode !== airport.iataCode) {
    const taken = await prisma.airport.findUnique({ where: { iataCode: data.iataCode } });
    if (taken) throw new DomainError("AIRPORT_EXISTS", "IATA code already exists.", 409);
  }

  if (data.cityId) {
    const city = await prisma.city.findUnique({ where: { id: data.cityId } });
    if (!city) throw new DomainError("CITY_NOT_FOUND", "City not found.", 404);
  }

  return prisma.airport.update({
    where: { id },
    data,
    include: { city: { include: { country: true } } },
  });
}

export async function listAirlines(activeOnly = false) {
  return prisma.airline.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { iataCode: "asc" },
  });
}

export async function createAirline(input: unknown) {
  const data = airlineWriteSchema.parse(input);
  const existing = await prisma.airline.findUnique({ where: { iataCode: data.iataCode } });
  if (existing) throw new DomainError("AIRLINE_EXISTS", "IATA code already exists.", 409);

  return prisma.airline.create({
    data: {
      iataCode: data.iataCode,
      icaoCode: data.icaoCode || null,
      name: data.name,
      logoUrl: data.logoUrl || null,
      isActive: data.isActive ?? true,
    },
  });
}

export async function updateAirline(id: string, input: unknown) {
  const data = airlineWriteSchema.partial().parse(input);
  const airline = await prisma.airline.findUnique({ where: { id } });
  if (!airline) throw new DomainError("AIRLINE_NOT_FOUND", "Airline not found.", 404);

  if (data.iataCode && data.iataCode !== airline.iataCode) {
    const taken = await prisma.airline.findUnique({ where: { iataCode: data.iataCode } });
    if (taken) throw new DomainError("AIRLINE_EXISTS", "IATA code already exists.", 409);
  }

  return prisma.airline.update({
    where: { id },
    data: {
      ...data,
      icaoCode: data.icaoCode === "" ? null : data.icaoCode,
      logoUrl: data.logoUrl === "" ? null : data.logoUrl,
    },
  });
}

export async function listCountries() {
  return prisma.country.findMany({
    include: { _count: { select: { cities: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createCountry(input: unknown) {
  const data = countryWriteSchema.parse(input);
  const existing = await prisma.country.findUnique({ where: { code: data.code } });
  if (existing) throw new DomainError("COUNTRY_EXISTS", "Country code already exists.", 409);
  return prisma.country.create({ data });
}

export async function listCities(countryId?: string) {
  return prisma.city.findMany({
    where: countryId ? { countryId } : undefined,
    include: { country: true, _count: { select: { airports: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createCity(input: unknown) {
  const data = cityWriteSchema.parse(input);
  const country = await prisma.country.findUnique({ where: { id: data.countryId } });
  if (!country) throw new DomainError("COUNTRY_NOT_FOUND", "Country not found.", 404);
  try {
    return await prisma.city.create({
      data: {
        countryId: data.countryId,
        name: data.name,
        code: data.code || null,
      },
      include: { country: true },
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      throw new DomainError("CITY_EXISTS", "That city already exists in this country.", 409);
    }
    throw error;
  }
}

export async function listSuppliers() {
  return prisma.supplier.findMany({ orderBy: { name: "asc" } });
}

export async function createSupplier(input: unknown) {
  const data = supplierWriteSchema.parse(input);
  return prisma.supplier.create({
    data: {
      name: data.name,
      type: data.type,
      status: data.status ?? "ACTIVE",
    },
  });
}

export async function updateSupplier(id: string, input: unknown) {
  const data = supplierWriteSchema.partial().parse(input);
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) throw new DomainError("SUPPLIER_NOT_FOUND", "Supplier not found.", 404);
  return prisma.supplier.update({ where: { id }, data });
}

export async function catalogSummary() {
  const [countries, cities, airports, airlines, suppliers] = await Promise.all([
    prisma.country.count(),
    prisma.city.count(),
    prisma.airport.count(),
    prisma.airline.count(),
    prisma.supplier.count(),
  ]);
  return { countries, cities, airports, airlines, suppliers };
}
