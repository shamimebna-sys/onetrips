import pino from "pino";

const REDACT_PATHS = [
  "password",
  "secret",
  "token",
  "authorization",
  "otp",
  "passport",
  "card",
  "cvv",
  "pan",
  "credential",
  "apiKey",
  "api_key",
  "*.password",
  "*.secret",
  "*.token",
  "*.authorization",
  "*.otp",
  "*.passportNumber",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: { paths: REDACT_PATHS, censor: "[redacted]" },
  base: { service: process.env.OTEL_SERVICE_NAME ?? "onetrips" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

function isDevLog() {
  return process.env.NODE_ENV !== "production";
}

function printDevInternalError(error: unknown, extra: Record<string, unknown>) {
  if (!isDevLog()) return;
  const err = error instanceof Error ? error : undefined;
  // Temporary development diagnostics: keep the original exception intact and print it in full.
  console.error("[DEV INTERNAL ERROR] original exception");
  console.error(`  reference: ${extra.reference ?? ""}`);
  console.error(`  name: ${err?.name ?? typeof error}`);
  console.error(`  message: ${err?.message ?? String(error)}`);
  console.error(`  stack:\n${err?.stack ?? "(no stack)"}`);
  if (err && "cause" in err && err.cause !== undefined) {
    const cause = err.cause;
    if (cause instanceof Error) {
      console.error(`  cause.name: ${cause.name}`);
      console.error(`  cause.message: ${cause.message}`);
      console.error(`  cause.stack:\n${cause.stack ?? "(no stack)"}`);
    } else {
      console.error(`  cause: ${String(cause)}`);
    }
  }
}

export function logError(error: unknown, extra: Record<string, unknown> = {}) {
  printDevInternalError(error, extra);
  if (error instanceof Error) {
    logger.error(
      {
        err: isDevLog()
          ? { message: error.message, name: error.name, stack: error.stack, cause: error.cause }
          : { message: error.message, name: error.name },
        ...extra,
      },
      error.message,
    );
    return;
  }
  logger.error({ err: error, ...extra }, "Unknown error");
}
