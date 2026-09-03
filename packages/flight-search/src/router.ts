import { MockFlightProvider } from "./adapters/mock";
import type { FlightProviderConfig } from "./config";
import { getFlightProviderConfig } from "./config";
import { InstrumentedFlightProvider } from "./gateway";
import type { FlightProviderPort } from "./types";

let singleton: FlightProviderPort | null = null;
let lastConfigKey = "";

function configKey(config: FlightProviderConfig) {
  return `${config.mode}:${config.mockScenario}:${config.searchTimeoutMs}:${config.bookingTimeoutMs}`;
}

export function createFlightProvider(config: FlightProviderConfig = getFlightProviderConfig()): FlightProviderPort {
  if (config.mode !== "mock") {
    throw new Error(`Unsupported flight provider mode: ${config.mode}`);
  }
  const inner = new MockFlightProvider(new Map(), new Map(), config.mockScenario);
  return new InstrumentedFlightProvider(inner, config);
}

export function getFlightProvider(): FlightProviderPort {
  const config = getFlightProviderConfig();
  const key = configKey(config);
  if (!singleton || lastConfigKey !== key) {
    singleton = createFlightProvider(config);
    lastConfigKey = key;
  }
  return singleton;
}

export function resetFlightProviderForTests() {
  singleton = null;
  lastConfigKey = "";
}
