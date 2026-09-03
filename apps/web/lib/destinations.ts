export const DESTINATIONS = [
  {
    slug: "dhaka",
    name: "Dhaka",
    code: "DAC",
    country: "Bangladesh",
    blurb: "Fly from Hazrat Shahjalal International to the Gulf, Southeast Asia, and Europe.",
  },
  {
    slug: "dubai",
    name: "Dubai",
    code: "DXB",
    country: "United Arab Emirates",
    blurb: "A year-round hub for connecting flights, hotels, and stopovers.",
  },
  {
    slug: "doha",
    name: "Doha",
    code: "DOH",
    country: "Qatar",
    blurb: "Hamad International is a frequent one-stop option on Gulf routes.",
  },
  {
    slug: "istanbul",
    name: "Istanbul",
    code: "IST",
    country: "Türkiye",
    blurb: "A long-haul gateway between South Asia and Europe.",
  },
  {
    slug: "kuala-lumpur",
    name: "Kuala Lumpur",
    code: "KUL",
    country: "Malaysia",
    blurb: "Popular for family visits, study travel, and regional hotels.",
  },
  {
    slug: "singapore",
    name: "Singapore",
    code: "SIN",
    country: "Singapore",
    blurb: "A compact city-state with strong hotel inventory and short-haul connections.",
  },
] as const;

export type Destination = (typeof DESTINATIONS)[number];

export function destinationBySlug(slug: string) {
  return DESTINATIONS.find((row) => row.slug === slug) ?? null;
}
