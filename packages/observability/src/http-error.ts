import { AppError, RateLimitError } from "@onetrips/shared";
import { captureException } from "./sentry";

export type PublicErrorPayload = {
  status: number;
  body: Record<string, unknown>;
  headers: Record<string, string>;
};

export function publicErrorPayload(error: unknown): PublicErrorPayload {
  if (error instanceof RateLimitError) {
    return {
      status: 429,
      body: error.toPublicJSON(),
      headers: { "Retry-After": String(error.retryAfterSec) },
    };
  }
  if (error instanceof AppError) {
    return { status: error.httpStatus, body: error.toPublicJSON(), headers: {} };
  }
  if (error instanceof Error && error.name === "ZodError") {
    return { status: 400, body: { code: "VALIDATION", message: "Invalid request." }, headers: {} };
  }
  const reference = crypto.randomUUID();
  void captureException(error, { reference });
  return {
    status: 500,
    body: { code: "INTERNAL", message: "Something went wrong.", reference },
    headers: {},
  };
}
