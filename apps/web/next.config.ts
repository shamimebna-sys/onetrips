import type { NextConfig } from "next";
import { nextConfigHeaders } from "@onetrips/observability/headers";
import { loadRootEnv } from "../../scripts/load-root-env.mjs";

loadRootEnv();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["pino", "@sentry/node", "@prisma/client", "@pdf-lib/fontkit", "regenerator-runtime"],
  transpilePackages: [
    "@onetrips/ui",
    "@onetrips/database",
    "@onetrips/shared",
    "@onetrips/auth",
    "@onetrips/catalog",
    "@onetrips/customer",
    "@onetrips/booking",
    "@onetrips/payments",
    "@onetrips/ticketing",
    "@onetrips/notifications",
    "@onetrips/finance",
    "@onetrips/refunds",
    "@onetrips/pricing",
    "@onetrips/promotions",
    "@onetrips/support",
    "@onetrips/flight-search",
    "@onetrips/hotel-search",
    "@onetrips/observability",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  headers: async () => nextConfigHeaders(),
};

export default nextConfig;
