import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

let redis: RedisClient | null = null;
let redisFailed = false;

export async function getSharedRedis(): Promise<RedisClient | null> {
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
