import { ProviderTimeoutError } from "@onetrips/shared";

export async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  details: { provider: string; operation: string; correlationId: string },
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ProviderTimeoutError(details));
    }, timeoutMs);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
