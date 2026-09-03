import type { PrismaClient } from "@prisma/client";
import { AIRLINES, AIRPORTS, CITIES, COUNTRIES, SUPPLIERS } from "./catalog-data";

export async function seedCatalog(prisma: PrismaClient) {
  for (const country of COUNTRIES) {
    await prisma.country.upsert({
      where: { code: country.code },
      update: { name: country.name },
      create: country,
    });
  }

  const countries = await prisma.country.findMany();
  const countryByCode = Object.fromEntries(countries.map((c) => [c.code, c.id]));

  for (const city of CITIES) {
    const countryId = countryByCode[city.country];
    if (!countryId) continue;
    await prisma.city.upsert({
      where: { countryId_name: { countryId, name: city.name } },
      update: { code: city.code },
      create: { countryId, name: city.name, code: city.code },
    });
  }

  const cities = await prisma.city.findMany({ include: { country: true } });
  const cityKey = (countryCode: string, name: string) => `${countryCode}:${name}`;
  const cityByKey = Object.fromEntries(
    cities.map((city) => [cityKey(city.country.code, city.name), city.id]),
  );

  for (const airport of AIRPORTS) {
    const cityId = cityByKey[cityKey(airport.country, airport.city)];
    if (!cityId) {
      console.warn(`Skipping airport ${airport.iata}: city ${airport.city} not found`);
      continue;
    }
    await prisma.airport.upsert({
      where: { iataCode: airport.iata },
      update: {
        name: airport.name,
        timezone: airport.timezone,
        cityId,
        isPopular: Boolean(airport.popular),
        isActive: true,
      },
      create: {
        iataCode: airport.iata,
        name: airport.name,
        timezone: airport.timezone,
        cityId,
        isPopular: Boolean(airport.popular),
        isActive: true,
      },
    });
  }

  for (const airline of AIRLINES) {
    await prisma.airline.upsert({
      where: { iataCode: airline.iata },
      update: { name: airline.name, icaoCode: airline.icao, isActive: true },
      create: {
        iataCode: airline.iata,
        icaoCode: airline.icao,
        name: airline.name,
        isActive: true,
      },
    });
  }

  for (const supplier of SUPPLIERS) {
    const existing = await prisma.supplier.findFirst({ where: { name: supplier.name } });
    if (existing) {
      await prisma.supplier.update({
        where: { id: existing.id },
        data: { type: supplier.type, status: "ACTIVE" },
      });
    } else {
      await prisma.supplier.create({
        data: { name: supplier.name, type: supplier.type, status: "ACTIVE" },
      });
    }
  }
}
