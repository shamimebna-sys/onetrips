import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

let redis: RedisClient | null = null;
let redisFailed = false;

export async function getNotifyRedis(): Promise<RedisClient | null> {
  if (redisFailed || !process.env.REDIS_URL) return null;
  if (redis?.isOpen) return redis;
  try {
    redis = createClient({ url: process.env.REDIS_URL });
    redis.on("error", (error) => {
      console.error("[notifications] Redis error", error);
    });
    await redis.connect();
    return redis;
  } catch (error) {
    redisFailed = true;
    console.warn("[notifications] Redis unavailable; notifications will send inline.", error);
    return null;
  }
}

export function queueBackend() {
  if (redisFailed || !process.env.REDIS_URL) return "inline" as const;
  return "redis" as const;
}
