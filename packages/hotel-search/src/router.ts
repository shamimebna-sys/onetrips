import { MockHotelProvider } from "./adapters/mock";
import { getHotelProviderConfig, type HotelProviderConfig } from "./config";
import type { HotelProviderPort } from "./types";

let singleton: HotelProviderPort | null = null;
let lastKey = "";

export function createHotelProvider(config: HotelProviderConfig = getHotelProviderConfig()): HotelProviderPort {
  if (config.mode !== "mock") {
    throw new Error(`Unsupported hotel provider mode: ${config.mode}`);
  }
  return new MockHotelProvider(config.mockScenario);
}

export function getHotelProvider(): HotelProviderPort {
  const config = getHotelProviderConfig();
  const key = `${config.mode}:${config.mockScenario}`;
  if (!singleton || lastKey !== key) {
    singleton = createHotelProvider(config);
    lastKey = key;
  }
  return singleton;
}

export function resetHotelProviderForTests() {
  singleton = null;
  lastKey = "";
}
