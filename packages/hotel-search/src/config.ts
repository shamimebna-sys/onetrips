export const MOCK_HOTEL_SCENARIOS = ["SUCCESS", "PRICE_CHANGED", "UNAVAILABLE"] as const;
export type MockHotelScenario = (typeof MOCK_HOTEL_SCENARIOS)[number];

export const HOTEL_PROVIDER_MODES = ["mock"] as const;
export type HotelProviderMode = (typeof HOTEL_PROVIDER_MODES)[number];

export type HotelProviderConfig = {
  mode: HotelProviderMode;
  mockScenario: MockHotelScenario;
};

export function getHotelProviderConfig(): HotelProviderConfig {
  const mode = (process.env.HOTEL_PROVIDER ?? "mock").trim().toLowerCase();
  if (mode === "sandbox" || mode === "production") {
    throw new Error(
      `HOTEL_PROVIDER=${mode} is reserved for a real hotel supplier adapter. Set HOTEL_PROVIDER=mock until credentials exist. Do not put hotel API keys in this environment.`,
    );
  }
  if (mode !== "mock") {
    throw new Error(`Unsupported HOTEL_PROVIDER="${mode}". Supported modes: mock`);
  }
  const scenario = (process.env.MOCK_HOTEL_SCENARIO ?? "SUCCESS").trim().toUpperCase();
  if (!MOCK_HOTEL_SCENARIOS.includes(scenario as MockHotelScenario)) {
    throw new Error(`Unsupported MOCK_HOTEL_SCENARIO="${scenario}".`);
  }
  return { mode: "mock", mockScenario: scenario as MockHotelScenario };
}
