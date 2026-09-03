import { describe, expect, it } from "vitest";
import { prisma } from "@onetrips/database";
import { searchAirports } from "./service";

function loadEnv() {
  try {
    const { readFileSync, existsSync } = require("node:fs") as typeof import("node:fs");
    const path = `${process.cwd()}/.env`;
    if (!existsSync(path)) return;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const hasDb = Boolean(process.env.DATABASE_URL);

function codes(rows: Array<{ iataCode: string }>) {
  return rows.map((row) => row.iataCode);
}

describe.skipIf(!hasDb)("searchAirports catalog matching", () => {
  it("finds Bangkok by code, city, country, and partials", async () => {
    expect(codes(await searchAirports({ q: "BKK" }))).toContain("BKK");
    expect(codes(await searchAirports({ q: "Bangkok" }))).toContain("BKK");
    expect(codes(await searchAirports({ q: "Thailand" }))).toContain("BKK");
    expect(codes(await searchAirports({ q: "Thai" }))).toContain("BKK");
    expect(codes(await searchAirports({ q: "bang" }))).toContain("BKK");
  });

  it("finds Dhaka and Bangladesh airports", async () => {
    expect(codes(await searchAirports({ q: "DAC" }))).toContain("DAC");
    expect(codes(await searchAirports({ q: "Dhaka" }))).toContain("DAC");
    const bangladesh = await searchAirports({ q: "Bangladesh" });
    expect(codes(bangladesh)).toContain("DAC");
    expect(bangladesh.every((row) => row.city.country.name === "Bangladesh")).toBe(true);
  });

  it("finds Dubai by code, city, and partial", async () => {
    expect(codes(await searchAirports({ q: "DXB" }))).toContain("DXB");
    expect(codes(await searchAirports({ q: "Dubai" }))).toContain("DXB");
    expect(codes(await searchAirports({ q: "dub" }))).toContain("DXB");
  });

  it("is case-insensitive and trims whitespace", async () => {
    const expected = codes(await searchAirports({ q: "Thailand" }));
    expect(codes(await searchAirports({ q: "thailand" }))).toEqual(expected);
    expect(codes(await searchAirports({ q: "THAILAND" }))).toEqual(expected);
    expect(codes(await searchAirports({ q: " Thailand " }))).toEqual(expected);
  });

  it("keeps exact IATA matches first", async () => {
    const rows = await searchAirports({ q: "BKK" });
    expect(rows[0]?.iataCode).toBe("BKK");
  });

  it("supports multi-word location queries", async () => {
    expect(codes(await searchAirports({ q: "New York" }))).toEqual(expect.arrayContaining(["JFK", "EWR"]));
    expect(codes(await searchAirports({ q: "United Arab Emirates" }))).toEqual(
      expect.arrayContaining(["DXB", "AUH"]),
    );
    expect(codes(await searchAirports({ q: "Dhaka Bangladesh" }))).toContain("DAC");
  });

  it("finds airports for every catalog country name, including IATA-prefix collisions", async () => {
    const countries = await prisma.country.findMany({
      include: { cities: { include: { airports: { where: { isActive: true }, take: 1 } } } },
    });
    const withAirports = countries.filter((country) => country.cities.some((city) => city.airports.length > 0));
    expect(withAirports.length).toBeGreaterThan(0);

    for (const country of withAirports) {
      const rows = await searchAirports({ q: country.name });
      expect(rows.some((row) => row.city.country.name === country.name), country.name).toBe(true);
      const upper = await searchAirports({ q: country.name.toUpperCase() });
      expect(upper.some((row) => row.city.country.name === country.name), `${country.name} upper`).toBe(true);
    }

    expect(codes(await searchAirports({ q: "France" }))).toContain("CDG");
    expect(codes(await searchAirports({ q: "Canada" }))).toContain("YYZ");
    expect((await searchAirports({ q: "FRA" }))[0]?.iataCode).toBe("FRA");
    expect((await searchAirports({ q: "CAN" }))[0]?.iataCode).toBe("CAN");
    expect(codes(await searchAirports({ q: "Tailand" }))).toContain("BKK");
  });
});
