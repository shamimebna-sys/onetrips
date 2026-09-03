import type { NextConfig } from "next";
import { nextConfigHeaders } from "@onetrips/observability/headers";
import { loadRootEnv } from "../../scripts/load-root-env.mjs";

loadRootEnv();

const nextConfig: NextConfig = {
  transpilePackages: [
    "@onetrips/ui",
    "@onetrips/auth",
    "@onetrips/database",
    "@onetrips/shared",
    "@onetrips/organization",
    "@onetrips/finance",
    "@onetrips/catalog",
    "@onetrips/booking",
    "@onetrips/payments",
    "@onetrips/ticketing",
    "@onetrips/pricing",
    "@onetrips/flight-search",
    "@onetrips/hotel-search",
    "@onetrips/customer",
    "@onetrips/notifications",
    "@onetrips/observability",
  ],
  serverExternalPackages: ["pino", "@sentry/node", "@prisma/client"],
  headers: async () => nextConfigHeaders(),
};

export default nextConfig;
