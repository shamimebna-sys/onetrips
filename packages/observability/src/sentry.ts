import * as Sentry from "@sentry/node";
import { logError, logger } from "./logger";

let started = false;

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || started) return;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    sendDefaultPii: false,
  });
  started = true;
  logger.info("Sentry initialized");
}

export async function captureException(error: unknown, extra: Record<string, unknown> = {}) {
  logError(error, extra);
  if (!process.env.SENTRY_DSN) return;
  initSentry();
  Sentry.captureException(error, { extra });
  await Sentry.flush(2000).catch(() => undefined);
}
