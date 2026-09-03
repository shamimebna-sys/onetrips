import "./load-env";
import { assertApplicationDatabaseUrl, databaseUrlProtocol } from "@onetrips/database/assert-url";
import { dequeueJob, promoteDelayed, queueBackend } from "./queue";
import { processQueuedJob } from "./service";

assertApplicationDatabaseUrl(process.env.DATABASE_URL, {
  required: process.env.NODE_ENV === "production",
  production: process.env.NODE_ENV === "production",
});
const databaseUrl = process.env.DATABASE_URL?.trim();
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  console.info(
    `[notify-worker] database=${databaseUrlProtocol(databaseUrl)} host=${parsed.hostname} db=${parsed.pathname.replace(/^\//, "")}`,
  );
}

let running = true;

async function loop() {
  console.info(`[notify-worker] backend=${queueBackend()} waiting for jobs`);
  while (running) {
    try {
      await promoteDelayed();
      const job = await dequeueJob(5);
      if (!job) continue;
      const result = await processQueuedJob(job);
      if (result.ok) {
        console.info(`[notify-worker] sent log=${job.logId} ${job.channel} ${job.recipient}`);
      } else if (result.retry) {
        console.warn(`[notify-worker] retry log=${job.logId} attempt=${result.attempt}`);
      } else {
        console.error(`[notify-worker] failed log=${job.logId} after ${result.attempt} attempts`);
      }
    } catch (error) {
      console.error("[notify-worker] loop error", error);
      await new Promise((resolveWait) => setTimeout(resolveWait, 2000));
    }
  }
}

process.on("SIGINT", () => {
  running = false;
});
process.on("SIGTERM", () => {
  running = false;
});

loop().catch((error) => {
  console.error(error);
  process.exit(1);
});
