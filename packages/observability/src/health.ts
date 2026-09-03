import { prisma } from "@onetrips/database";
import { pingRedis } from "./redis";

export type HealthApp = "web" | "admin" | "b2b" | "worker" | "unknown";

function appFromEnv(): HealthApp {
  const name = (process.env.OTEL_SERVICE_NAME ?? process.env.OT_APP ?? "").toLowerCase();
  if (name.includes("admin")) return "admin";
  if (name.includes("b2b") || name.includes("agency")) return "b2b";
  if (name.includes("worker") || name.includes("notif")) return "worker";
  if (name.includes("web") || name.includes("customer")) return "web";
  return "unknown";
}

export async function getHealth(app?: HealthApp) {
  let database = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }
  const redis = await pingRedis();
  const identity = app ?? appFromEnv();
  const production = process.env.NODE_ENV === "production";
  const redisRequired = production || process.env.OT_HEALTH_REQUIRE_REDIS === "1";
  const degraded = database && !redis;
  const ok = database && (!redisRequired || redis);
  return {
    ok,
    degraded,
    service: process.env.OTEL_SERVICE_NAME ?? "onetrips",
    app: identity,
    version: process.env.npm_package_version ?? "0.1.0",
    checks: {
      database,
      redis,
    },
  };
}
