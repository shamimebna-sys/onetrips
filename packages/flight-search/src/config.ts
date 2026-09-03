export const MOCK_GDS_SCENARIOS = [
  "SUCCESS",
  "PRICE_CHANGED",
  "UNAVAILABLE",
  "TIMEOUT",
  "RATE_LIMIT",
  "MALFORMED_RESPONSE",
  "BOOKING_SUCCESS",
  "BOOKING_TIMEOUT",
  "BOOKING_FAILURE",
  "TICKETING_SUCCESS",
  "TICKETING_TIMEOUT",
  "TICKETING_FAILURE",
  "CANCEL_SUCCESS",
  "CANCEL_TIMEOUT",
  "CANCEL_FAILURE",
  "VOID_SUCCESS",
  "VOID_FAILURE",
] as const;

export type MockGdsScenario = (typeof MOCK_GDS_SCENARIOS)[number];

export const FLIGHT_PROVIDER_MODES = ["mock"] as const;
export type FlightProviderMode = (typeof FLIGHT_PROVIDER_MODES)[number];

export type FlightProviderConfig = {
  mode: FlightProviderMode;
  searchTimeoutMs: number;
  revalidationTimeoutMs: number;
  bookingTimeoutMs: number;
  ticketingTimeoutMs: number;
  cancellationTimeoutMs: number;
  mockScenario: MockGdsScenario;
  circuitFailureThreshold: number;
  circuitOpenMs: number;
  retryLimit: number;
};

function intEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) {
    throw new Error(`${name} must be a positive number.`);
  }
  return value;
}

export function getFlightProviderConfig(): FlightProviderConfig {
  const mode = (process.env.FLIGHT_PROVIDER ?? "mock").trim().toLowerCase();
  if (mode === "sandbox" || mode === "production") {
    throw new Error(
      `FLIGHT_PROVIDER=${mode} is reserved for a real GDS adapter. Set FLIGHT_PROVIDER=mock until credentials exist. Do not put GDS keys in this environment.`,
    );
  }
  if (mode !== "mock") {
    throw new Error(`Unsupported FLIGHT_PROVIDER="${mode}". Supported modes: mock`);
  }
  const scenario = (process.env.MOCK_GDS_SCENARIO ?? "SUCCESS").trim().toUpperCase();
  if (!MOCK_GDS_SCENARIOS.includes(scenario as MockGdsScenario)) {
    throw new Error(`Unsupported MOCK_GDS_SCENARIO="${scenario}".`);
  }
  return {
    mode: "mock",
    searchTimeoutMs: intEnv("GDS_SEARCH_TIMEOUT_MS", 15_000),
    revalidationTimeoutMs: intEnv("GDS_REVALIDATION_TIMEOUT_MS", 10_000),
    bookingTimeoutMs: intEnv("GDS_BOOKING_TIMEOUT_MS", 20_000),
    ticketingTimeoutMs: intEnv("GDS_TICKETING_TIMEOUT_MS", 20_000),
    cancellationTimeoutMs: intEnv("GDS_CANCELLATION_TIMEOUT_MS", 15_000),
    mockScenario: scenario as MockGdsScenario,
    circuitFailureThreshold: intEnv("GDS_CIRCUIT_FAILURE_THRESHOLD", 5),
    circuitOpenMs: intEnv("GDS_CIRCUIT_OPEN_MS", 30_000),
    retryLimit: intEnv("GDS_RETRY_LIMIT", 2),
  };
}

export const DEFAULT_CAPABILITIES = {
  search: true,
  revalidate: true,
  createBooking: true,
  getBookingStatus: true,
  issueTicket: true,
  voidTicket: true,
  cancelBooking: true,
  getFareRules: true,
  getSeatMap: true,
} as const;
