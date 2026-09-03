const SENSITIVE = /password|secret|authorization|api[-_]?key|otp|passport|card|cvv|pan|token|credential/i;

export function redact(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.length > 24 && SENSITIVE.test(value)) return "[redacted]";
    return value;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE.test(key) ? "[redacted]" : redact(entry);
    }
    return out;
  }
  return value;
}

export function logProviderOp(entry: {
  correlationId: string;
  bookingId?: string;
  operation: string;
  provider: string;
  durationMs: number;
  result: "SUCCESS" | "FAILURE" | "TIMEOUT" | "UNKNOWN";
  providerReference?: string;
  errorCategory?: string;
}) {
  console.info(
    JSON.stringify({
      evt: "gds.op",
      ...entry,
      at: new Date().toISOString(),
    }),
  );
}
