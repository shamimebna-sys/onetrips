/**
 * Concurrent mock flight-search load against a running app.
 * Does not require k6. Providers stay mock.
 *
 *   npm run load:search
 *   LOAD_BASE_URL=http://localhost:3000 LOAD_CONCURRENCY=10 LOAD_REQUESTS=50 npm run load:search
 */
const base = (process.env.LOAD_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const concurrency = Math.max(1, Number(process.env.LOAD_CONCURRENCY || 8));
const total = Math.max(1, Number(process.env.LOAD_REQUESTS || 40));

const departure = new Date();
departure.setDate(departure.getDate() + 21);
const date = departure.toISOString().slice(0, 10);

const url = `${base}/api/flights/search?from=DAC&to=DXB&date=${date}&type=one-way&adults=1`;

async function once(i) {
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: { "x-load-test": "1" } });
    const ms = Date.now() - started;
    return { i, ok: res.ok, status: res.status, ms };
  } catch (error) {
    return { i, ok: false, status: 0, ms: Date.now() - started, error: error instanceof Error ? error.message : "request failed" };
  }
}

async function main() {
  console.log(`[load-search] ${total} requests, concurrency ${concurrency} -> ${url}`);
  const results = [];
  let next = 0;
  async function worker() {
    while (next < total) {
      const i = next;
      next += 1;
      results.push(await once(i));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));
  const ok = results.filter((r) => r.ok).length;
  const limited = results.filter((r) => r.status === 429).length;
  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const p95 = times[Math.min(times.length - 1, Math.floor(times.length * 0.95))];
  const avg = Math.round(times.reduce((sum, n) => sum + n, 0) / times.length);
  console.log(`[load-search] ok=${ok}/${total} status_429=${limited} avg_ms=${avg} p95_ms=${p95} max_ms=${times[times.length - 1]}`);
  if (ok === 0) process.exit(1);
}

main();
