import type { QueueJob } from "./types";
import { getNotifyRedis, queueBackend } from "./redis";

export const QUEUE_KEY = "ot:notify:queue";
export const DELAYED_KEY = "ot:notify:delayed";

export { queueBackend };

export async function enqueueJob(job: QueueJob) {
  const client = await getNotifyRedis();
  if (!client) return false;
  await client.lPush(QUEUE_KEY, JSON.stringify(job));
  return true;
}

export async function enqueueDelayed(job: QueueJob, delayMs: number) {
  const client = await getNotifyRedis();
  if (!client) return false;
  await client.zAdd(DELAYED_KEY, { score: Date.now() + delayMs, value: JSON.stringify(job) });
  return true;
}

export async function promoteDelayed() {
  const client = await getNotifyRedis();
  if (!client) return 0;
  const due = await client.zRangeByScore(DELAYED_KEY, 0, Date.now());
  if (due.length === 0) return 0;
  for (const value of due) {
    await client.lPush(QUEUE_KEY, value);
    await client.zRem(DELAYED_KEY, value);
  }
  return due.length;
}

export async function dequeueJob(timeoutSeconds = 5): Promise<QueueJob | null> {
  const client = await getNotifyRedis();
  if (!client) return null;
  const result = await client.brPop(QUEUE_KEY, timeoutSeconds);
  if (!result) return null;
  return JSON.parse(result.element) as QueueJob;
}

export async function queueDepth() {
  const client = await getNotifyRedis();
  if (!client) return { ready: 0, delayed: 0, backend: queueBackend() };
  const [ready, delayed] = await Promise.all([client.lLen(QUEUE_KEY), client.zCard(DELAYED_KEY)]);
  return { ready: Number(ready), delayed: Number(delayed), backend: queueBackend() };
}
