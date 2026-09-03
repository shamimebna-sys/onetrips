import { isRetryableProviderError } from "@onetrips/shared";

const SAFE_RETRY_OPS = new Set(["search", "getBookingStatus", "getFareRules", "getSeatMap", "revalidate"]);

export function isSafeToRetry(operation: string) {
  return SAFE_RETRY_OPS.has(operation);
}

export async function withRetry<T>(
  operation: string,
  fn: () => Promise<T>,
  options: { retries: number; delayMs?: number } = { retries: 2 },
): Promise<T> {
  const retries = isSafeToRetry(operation) ? Math.max(0, options.retries) : 0;
  const delayMs = options.delayMs ?? 150;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isRetryableProviderError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}
