import { getSharedRedis } from "./redis";

export type ProviderHealthStatus = "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "UNKNOWN";

export type ProviderHealth = {
  provider: string;
  status: ProviderHealthStatus;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  failureCount: number;
  successCount: number;
  latencyMs: number;
  checkedAt: string;
};

type Acc = {
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  failureCount: number;
  successCount: number;
  latencySum: number;
  samples: number;
};

const acc = new Map<string, Acc>();

function emptyAcc(): Acc {
  return { lastSuccessAt: null, lastFailureAt: null, failureCount: 0, successCount: 0, latencySum: 0, samples: 0 };
}

function statusOf(row: Acc): ProviderHealthStatus {
  if (row.samples === 0) return "UNKNOWN";
  const recentFail = row.lastFailureAt && Date.now() - row.lastFailureAt < 60_000;
  if (row.failureCount >= 5 && recentFail) return "UNAVAILABLE";
  if (row.failureCount > 0 && recentFail) return "DEGRADED";
  return "HEALTHY";
}

export async function recordProviderSample(provider: string, ok: boolean, latencyMs: number) {
  const row = acc.get(provider) ?? emptyAcc();
  row.samples += 1;
  row.latencySum += latencyMs;
  if (ok) {
    row.successCount += 1;
    row.lastSuccessAt = Date.now();
  } else {
    row.failureCount += 1;
    row.lastFailureAt = Date.now();
  }
  acc.set(provider, row);
  const client = await getSharedRedis();
  if (!client) return;
  try {
    await client.setEx(`ot:gds:health:${provider}`, 3600, JSON.stringify(row));
  } catch {
    /* ignore */
  }
}

export async function getProviderHealth(provider: string): Promise<ProviderHealth> {
  let row = acc.get(provider);
  if (!row) {
    const client = await getSharedRedis();
    if (client) {
      try {
        const raw = await client.get(`ot:gds:health:${provider}`);
        if (raw) row = JSON.parse(raw) as Acc;
      } catch {
        /* ignore */
      }
    }
  }
  const current = row ?? emptyAcc();
  return {
    provider,
    status: statusOf(current),
    lastSuccessAt: current.lastSuccessAt ? new Date(current.lastSuccessAt).toISOString() : null,
    lastFailureAt: current.lastFailureAt ? new Date(current.lastFailureAt).toISOString() : null,
    failureCount: current.failureCount,
    successCount: current.successCount,
    latencyMs: current.samples ? Math.round(current.latencySum / current.samples) : 0,
    checkedAt: new Date().toISOString(),
  };
}

export function resetHealthForTests() {
  acc.clear();
}
