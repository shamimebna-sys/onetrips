import { describe, expect, it } from "vitest";
import {
  airportMatchesQuery,
  airportMatchRank,
  filterAndRankAirports,
  normalizeAirportCompare,
  normalizeAirportQuery,
  positionAnchoredDropdown,
  preserveInProgressAirportQuery,
  type AirportSearchRecord,
} from "./airport-search";

function airport(
  iataCode: string,
  name: string,
  city: string,
  countryName: string,
  countryCode: string,
  extra?: { isPopular?: boolean; cityCode?: string },
): AirportSearchRecord {
  return {
    iataCode,
    name,
    isPopular: extra?.isPopular,
    city: { name: city, code: extra?.cityCode ?? iataCode, country: { name: countryName, code: countryCode } },
  };
}

const airports: AirportSearchRecord[] = [
  airport("BKK", "Suvarnabhumi Airport", "Bangkok", "Thailand", "TH", { isPopular: true }),
  airport("DMK", "Don Mueang International Airport", "Bangkok", "Thailand", "TH"),
  airport("DAC", "Hazrat Shahjalal International Airport", "Dhaka", "Bangladesh", "BD", { isPopular: true }),
  airport("CGP", "Shah Amanat International Airport", "Chittagong", "Bangladesh", "BD"),
  airport("DXB", "Dubai International Airport", "Dubai", "United Arab Emirates", "AE", { isPopular: true }),
  airport("AUH", "Abu Dhabi International Airport", "Abu Dhabi", "United Arab Emirates", "AE", { isPopular: true }),
  airport("JFK", "John F. Kennedy International Airport", "New York", "United States", "US", { cityCode: "NYC" }),
  airport("JED", "King Abdulaziz International Airport", "Jeddah", "Saudi Arabia", "SA", { isPopular: true }),
  airport("FRA", "Frankfurt Airport", "Frankfurt", "Germany", "DE"),
  airport("CDG", "Paris Charles de Gaulle Airport", "Paris", "France", "FR"),
  airport("CAN", "Guangzhou Baiyun International Airport", "Guangzhou", "China", "CN"),
  airport("YYZ", "Toronto Pearson International Airport", "Toronto", "Canada", "CA"),
  airport("CMB", "Bandaranaike International Airport", "Colombo", "Sri Lanka", "LK"),
  airport("SYD", "Sydney Kingsford Smith Airport", "Sydney", "Australia", "AU"),
  airport("LHR", "London Heathrow Airport", "London", "United Kingdom", "GB", { isPopular: true, cityCode: "LON" }),
  airport("ABJ", "Felix Houphouet-Boigny Airport", "Abidjan", "Côte d'Ivoire", "CI"),
];

function codes(q: string) {
  return filterAndRankAirports(airports, q).map((row) => row.iataCode);
}

function countryNamesInFixture() {
  return [...new Set(airports.map((row) => row.city.country.name))];
}

describe("normalizeAirportQuery", () => {
  it("trims, collapses whitespace, lowercases, and applies Unicode compatibility", () => {
    expect(normalizeAirportQuery(" Thailand ")).toBe("thailand");
    expect(normalizeAirportQuery("THAILAND")).toBe("thailand");
    expect(normalizeAirportQuery("ThaiLand")).toBe("thailand");
    expect(normalizeAirportQuery("New   York")).toBe("new york");
    expect(normalizeAirportCompare("Côte d'Ivoire")).toBe(normalizeAirportCompare("Cote dIvoire"));
    expect(normalizeAirportCompare("côte d’ivoire")).toBe(normalizeAirportCompare("Cote d'Ivoire"));
  });
});

describe("preserveInProgressAirportQuery", () => {
  it("keeps a longer country/city query when the form value is only the IATA-length slice", () => {
    expect(preserveInProgressAirportQuery("FRANCE", "FRA")).toBe("FRANCE");
    expect(preserveInProgressAirportQuery("CANADA", "CAN")).toBe("CANADA");
    expect(preserveInProgressAirportQuery("UNITED KINGDOM", "UNI")).toBe("UNITED KINGDOM");
  });

  it("accepts external IATA value changes such as swap or selection", () => {
    expect(preserveInProgressAirportQuery("CDG", "JFK")).toBe("JFK");
    expect(preserveInProgressAirportQuery("FRANCE", "DAC")).toBe("DAC");
    expect(preserveInProgressAirportQuery("", "DAC")).toBe("DAC");
  });
});

describe("airport search matching", () => {
  it("finds every fixture country by its stored human-readable name", () => {
    for (const countryName of countryNamesInFixture()) {
      const expected = airports.filter((row) => row.city.country.name === countryName).map((row) => row.iataCode);
      expect(codes(countryName), countryName).toEqual(expect.arrayContaining(expected));
      expect(codes(countryName.toUpperCase()), countryName).toEqual(expect.arrayContaining(expected));
      expect(codes(` ${countryName} `), countryName).toEqual(expect.arrayContaining(expected));
    }
  });

  it("finds countries whose first three letters collide with another IATA code", () => {
    expect(codes("France")).toContain("CDG");
    expect(codes("France")[0]).toBe("CDG");
    expect(codes("Canada")).toContain("YYZ");
    expect(codes("Canada")[0]).toBe("YYZ");
    expect(codes("FRA")[0]).toBe("FRA");
    expect(codes("CAN")[0]).toBe("CAN");
  });

  it("finds Bangkok by IATA, city, country, and partials", () => {
    expect(codes("BKK")).toContain("BKK");
    expect(codes("Bangkok")).toEqual(expect.arrayContaining(["BKK", "DMK"]));
    expect(codes("Thailand")).toEqual(expect.arrayContaining(["BKK", "DMK"]));
    expect(codes("Thai")).toEqual(expect.arrayContaining(["BKK", "DMK"]));
    expect(codes("bang").slice(0, 2)).toEqual(["BKK", "DMK"]);
  });

  it("finds Dhaka and Bangladesh airports", () => {
    expect(codes("DAC")).toContain("DAC");
    expect(codes("Dhaka")).toContain("DAC");
    expect(codes("Bangladesh")).toEqual(expect.arrayContaining(["DAC", "CGP"]));
  });

  it("finds Dubai by IATA, city, and partial", () => {
    expect(codes("DXB")).toContain("DXB");
    expect(codes("Dubai")).toContain("DXB");
    expect(codes("dub")).toContain("DXB");
  });

  it("matches country codes when present", () => {
    expect(codes("TH")).toEqual(expect.arrayContaining(["BKK", "DMK"]));
    expect(codes("FR")).toContain("CDG");
    expect(codes("CA")).toContain("YYZ");
    expect(codes("GB")).toContain("LHR");
  });

  it("supports multi-word location queries", () => {
    expect(codes("New York")).toContain("JFK");
    expect(codes("United Arab Emirates")).toEqual(expect.arrayContaining(["AUH", "DXB"]));
    expect(codes("United Kingdom")).toContain("LHR");
    expect(codes("Sri Lanka")).toContain("CMB");
    expect(codes("Saudi Arabia")).toContain("JED");
    expect(codes("Dhaka Bangladesh")).toContain("DAC");
  });

  it("matches accented country names after Unicode normalization", () => {
    expect(airportMatchesQuery(airports.find((row) => row.iataCode === "ABJ")!, "Cote d'Ivoire")).toBe(true);
    expect(airportMatchesQuery(airports.find((row) => row.iataCode === "ABJ")!, "côte d’ivoire")).toBe(true);
    expect(codes("Cote d'Ivoire")).toContain("ABJ");
  });

  it("returns no results when nothing matches", () => {
    expect(codes("Atlantis")).toEqual([]);
  });

  it("tolerates a single-character country typo without hardcoded aliases", () => {
    expect(codes("Tailand")).toEqual(expect.arrayContaining(["BKK", "DMK"]));
    expect(codes("Thailnd")).toEqual(expect.arrayContaining(["BKK", "DMK"]));
  });
});

describe("airport search ranking", () => {
  it("keeps exact IATA matches ahead of country matches", () => {
    expect(codes("BKK")[0]).toBe("BKK");
    expect(airportMatchRank(airports[0], "BKK")).toBeLessThan(
      airportMatchRank(airport("XYZ", "Example Airport", "Example", "Bkkland", "ZZ"), "BKK"),
    );
  });

  it("prioritizes city matches over country matches", () => {
    expect(airportMatchRank(airports[0], "Bangkok")).toBeLessThan(airportMatchRank(airports[0], "Thailand"));
    expect(filterAndRankAirports(airports, "Bangkok")[0]?.iataCode).toBe("BKK");
  });
});

describe("positionAnchoredDropdown", () => {
  const field = { top: 200, left: 80, width: 240, height: 88, bottom: 288 };

  it("anchors below the field with the same width when space exists", () => {
    const box = positionAnchoredDropdown(field, { width: 1280, height: 800 });
    expect(box.placement).toBe("below");
    expect(box.left).toBe(80);
    expect(box.width).toBe(240);
    expect(box.top).toBe(292);
  });

  it("stays below the field so it remains attached to the trigger", () => {
    const box = positionAnchoredDropdown(field, { width: 1280, height: 360 });
    expect(box.placement).toBe("below");
    expect(box.left).toBe(80);
    expect(box.width).toBe(240);
    expect(box.top).toBe(292);
  });

  it("flips above only when the field bottom is at or past the viewport", () => {
    const box = positionAnchoredDropdown(field, { width: 1280, height: 280 });
    expect(box.placement).toBe("above");
    expect(box.width).toBe(240);
    expect(box.transform).toBe("translateY(-100%)");
  });

  it("keeps the panel inside the viewport horizontally", () => {
    const box = positionAnchoredDropdown(
      { top: 40, left: 1200, width: 240, height: 80, bottom: 120 },
      { width: 1280, height: 800 },
    );
    expect(box.left).toBe(1040);
    expect(box.width).toBe(240);
    expect(box.left + box.width).toBeLessThanOrEqual(1280);
  });
});
