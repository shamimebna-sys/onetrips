import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

let redis: RedisClient | null = null;
let redisFailed = false;

export async function getObservabilityRedis(): Promise<RedisClient | null> {
  if (redisFailed || !process.env.REDIS_URL) return null;
  if (redis?.isOpen) return redis;
  try {
    redis = createClient({ url: process.env.REDIS_URL });
    redis.on("error", () => {
      redisFailed = true;
    });
    await redis.connect();
    return redis;
  } catch {
    redisFailed = true;
    return null;
  }
}

export async function pingRedis(): Promise<boolean> {
  const client = await getObservabilityRedis();
  if (!client) return false;
  try {
    const pong = await client.ping();
    return pong === "PONG" || pong === "pong" || Boolean(pong);
  } catch {
    return false;
  }
}

export function resetObservabilityRedisForTests() {
  redis = null;
  redisFailed = false;
}
