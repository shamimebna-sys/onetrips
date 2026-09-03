import { getSharedRedis } from "./redis";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

type CircuitSnapshot = {
  state: CircuitState;
  failures: number;
  openedAt: number | null;
  lastFailureAt: number | null;
};

const memory = new Map<string, CircuitSnapshot>();

function empty(): CircuitSnapshot {
  return { state: "CLOSED", failures: 0, openedAt: null, lastFailureAt: null };
}

async function load(provider: string): Promise<CircuitSnapshot> {
  const client = await getSharedRedis();
  if (client) {
    try {
      const raw = await client.get(`ot:gds:circuit:${provider}`);
      if (raw) return JSON.parse(raw) as CircuitSnapshot;
    } catch {
      /* memory */
    }
  }
  return memory.get(provider) ?? empty();
}

async function save(provider: string, snap: CircuitSnapshot) {
  memory.set(provider, snap);
  const client = await getSharedRedis();
  if (!client) return;
  try {
    await client.setEx(`ot:gds:circuit:${provider}`, 3600, JSON.stringify(snap));
  } catch {
    /* ignore redis */
  }
}

export async function getCircuitState(
  provider: string,
  options: { openMs: number },
): Promise<CircuitState> {
  const snap = await load(provider);
  if (snap.state === "OPEN" && snap.openedAt && Date.now() - snap.openedAt >= options.openMs) {
    snap.state = "HALF_OPEN";
    await save(provider, snap);
  }
  return snap.state;
}

export async function assertCircuitClosed(
  provider: string,
  options: { openMs: number },
): Promise<CircuitState> {
  return getCircuitState(provider, options);
}

export async function recordCircuitSuccess(provider: string) {
  await save(provider, empty());
}

export async function recordCircuitFailure(
  provider: string,
  options: { threshold: number; openMs: number },
) {
  const snap = await load(provider);
  if (snap.state === "HALF_OPEN") {
    snap.state = "OPEN";
    snap.openedAt = Date.now();
    snap.lastFailureAt = Date.now();
    snap.failures += 1;
    await save(provider, snap);
    return snap;
  }
  snap.failures += 1;
  snap.lastFailureAt = Date.now();
  if (snap.failures >= options.threshold) {
    snap.state = "OPEN";
    snap.openedAt = Date.now();
  }
  await save(provider, snap);
  return snap;
}

export async function getCircuitSnapshot(provider: string, openMs: number) {
  const state = await getCircuitState(provider, { openMs });
  const snap = (await load(provider)) ?? empty();
  return { ...snap, state };
}

export function resetCircuitForTests() {
  memory.clear();
}
