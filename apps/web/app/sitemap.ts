import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/",
    "/flights",
    "/hotels",
    "/offers",
    "/destinations",
    "/destination/dhaka",
    "/destination/dubai",
    "/destination/doha",
    "/destination/istanbul",
    "/destination/kuala-lumpur",
    "/destination/singapore",
    "/about",
    "/contact",
    "/help",
    "/faq",
    "/terms",
    "/privacy",
    "/refund-policy",
    "/cancellation-policy",
  ];
  return paths.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
