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
    "@onetrips/catalog",
    "@onetrips/organization",
    "@onetrips/finance",
    "@onetrips/pricing",
    "@onetrips/promotions",
    "@onetrips/support",
    "@onetrips/booking",
    "@onetrips/customer",
    "@onetrips/ticketing",
    "@onetrips/ops",
    "@onetrips/notifications",
    "@onetrips/refunds",
    "@onetrips/payments",
    "@onetrips/flight-search",
    "@onetrips/observability",
  ],
  serverExternalPackages: ["pino", "@sentry/node", "@prisma/client"],
  headers: async () => nextConfigHeaders(),
};

export default nextConfig;
