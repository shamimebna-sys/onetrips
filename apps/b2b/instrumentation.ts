import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { assertProductionEnv, assertPostgresDatabaseUrl, initSentry } = await import("@onetrips/observability");
  // MySQL is never an application database. OT_ALLOW_DEV_SECRETS cannot switch this.
  assertPostgresDatabaseUrl();
  if (process.env.NODE_ENV === "production" && process.env.OT_ALLOW_DEV_SECRETS !== "1") {
    assertProductionEnv();
  }
  initSentry();
}

export const onRequestError: Instrumentation.onRequestError = async (error) => {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { captureException } = await import("@onetrips/observability");
  await captureException(error);
};
