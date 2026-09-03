import { getFlightProviderConfig } from "./config";
import { getCircuitSnapshot } from "./circuit";
import { getProviderHealth } from "./health";
import { listRecentOperations } from "./operations";
import { getFlightProvider } from "./router";

export async function getFlightProviderSnapshot() {
  const config = getFlightProviderConfig();
  const provider = getFlightProvider();
  const [health, circuit, operations] = await Promise.all([
    getProviderHealth(provider.id),
    getCircuitSnapshot(provider.id, config.circuitOpenMs),
    listRecentOperations(25),
  ]);
  return {
    mode: config.mode,
    provider: provider.id,
    mockScenario: config.mockScenario,
    timeouts: {
      searchMs: config.searchTimeoutMs,
      revalidationMs: config.revalidationTimeoutMs,
      bookingMs: config.bookingTimeoutMs,
      ticketingMs: config.ticketingTimeoutMs,
      cancellationMs: config.cancellationTimeoutMs,
    },
    capabilities: provider.capabilities,
    health,
    circuit: {
      state: circuit.state,
      failures: circuit.failures,
      openedAt: circuit.openedAt ? new Date(circuit.openedAt).toISOString() : null,
      lastFailureAt: circuit.lastFailureAt ? new Date(circuit.lastFailureAt).toISOString() : null,
    },
    operations,
  };
}
