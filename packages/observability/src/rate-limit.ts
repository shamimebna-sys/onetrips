import { DomainError, RateLimitError } from "@onetrips/shared";
import { getObservabilityRedis } from "./redis";

type Bucket = { count: number; resetAt: number };

const memory = new Map<string, Bucket>();

function keyFor(bucket: string) {
  return `ot:rl:${bucket}`;
}

function memoryConsume(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const existing = memory.get(key);
  if (!existing || existing.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: Math.ceil(windowMs / 1000) };
  }
  if (existing.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  existing.count += 1;
  return { ok: true, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
}

/** Redis sorted-set sliding window; in-memory fixed window if Redis is down. */
export async function consumeRateLimit(
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfterSec: number }> {
  const key = keyFor(bucket);
  const client = await getObservabilityRedis();
  if (client) {
    try {
      const now = Date.now();
      const windowStart = now - windowMs;
      const member = `${now}:${crypto.randomUUID()}`;
      const tx = client.multi();
      tx.zRemRangeByScore(key, 0, windowStart);
      tx.zAdd(key, { score: now, value: member });
      tx.zCard(key);
      tx.pExpire(key, windowMs);
      const replies = await tx.exec();
      const count = Number(replies[2] ?? 0);
      if (count > limit) {
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil(windowMs / 1000)) };
      }
      return { ok: true, retryAfterSec: Math.ceil(windowMs / 1000) };
    } catch {
      /* fall through */
    }
  }
  return memoryConsume(key, limit, windowMs);
}

export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}

export async function assertHttpRateLimit(req: Request, name: string, limit: number, windowMs: number) {
  const result = await consumeRateLimit(`${name}:${clientIp(req)}`, limit, windowMs);
  if (!result.ok) {
    throw new RateLimitError("Too many requests. Please wait and try again.", result.retryAfterSec);
  }
}

export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("host");
  if (!host) return;
  try {
    if (new URL(origin).host !== host) {
      throw new DomainError("CSRF", "Invalid request origin.", 403);
    }
  } catch (error) {
    if (error instanceof DomainError) throw error;
  }
}

export function assertMutationOrigin(req: Request) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  assertSameOrigin(req);
}

export const RATE_LIMITS = {
  search: { limit: 30, windowMs: 60_000 },
  booking: { limit: 10, windowMs: 60_000 },
  payment: { limit: 10, windowMs: 60_000 },
  register: { limit: process.env.NODE_ENV === "production" ? 8 : 40, windowMs: 15 * 60_000 },
  login: { limit: process.env.NODE_ENV === "production" ? 12 : 60, windowMs: 15 * 60_000 },
  otp: { limit: process.env.NODE_ENV === "production" ? 3 : 20, windowMs: 10 * 60_000 },
  account: { limit: 30, windowMs: 60_000 },
  promo: { limit: 10, windowMs: 60_000 },
} as const;
