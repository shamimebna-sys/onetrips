# Flight provider contract (Phase 14A)

ONETRIPS talks to airlines only through `FlightProviderPort` in `@onetrips/flight-search`. Customer, B2B, and admin UIs never call a GDS. Domain packages consume **normalized** offers, bookings, and tickets.

## Architecture

```text
Provider API
     ↓
Adapter (MockFlightProvider today)
     ↓
Mapper (identity for mock)
     ↓
InstrumentedFlightProvider (timeout, retry, circuit, idempotency, logs)
     ↓
Domain (search, booking, ticketing, refunds)
     ↓
UI
```

Provider selection is `getFlightProvider()` in `packages/flight-search/src/router.ts`. `FLIGHT_PROVIDER=mock` is the only supported mode. `sandbox` / `production` fail fast until a real adapter exists.

## FlightProviderPort

```ts
search, revalidate, createBooking, getBookingStatus,
issueTicket, voidTicket, cancelBooking, getFareRules, getSeatMap
```

Request/response types live in `packages/flight-search/src/types.ts`. Do not leak raw vendor JSON past the adapter.

## Errors

Adapters throw `ProviderError` subclasses from `@onetrips/shared` (`ProviderTimeoutError`, `ProviderUnavailableError`, `ProviderRateLimitError`, …). `toPublicJSON()` never includes credentials, stack traces, or raw provider payloads. Ops can use `toOpsJSON()`.

## Timeouts

| Env | Default | Used for |
| --- | --- | --- |
| `GDS_SEARCH_TIMEOUT_MS` | 15000 | search |
| `GDS_REVALIDATION_TIMEOUT_MS` | 10000 | revalidate, status, fare rules |
| `GDS_BOOKING_TIMEOUT_MS` | 20000 | createBooking |
| `GDS_TICKETING_TIMEOUT_MS` | 20000 | issueTicket |
| `GDS_CANCELLATION_TIMEOUT_MS` | 15000 | cancel / void |

## Retry

Safe to retry: `search`, `revalidate`, `getBookingStatus`, `getFareRules`, `getSeatMap`.

Never blindly retry: `createBooking`, `issueTicket`, `voidTicket`, `cancelBooking`. After a timeout the gateway calls `getBookingStatus` and reuses the existing PNR/tickets when found.

## Idempotency

Keys are stored on `ProviderOperation` (PostgreSQL, unique `idempotencyKey`):

- `book:{bookingId}`
- `ticket:{bookingId}`
- `void:{bookingId}:{ticketNumber}`
- `cancel:{bookingId}`

Redis is **not** authoritative for these. Search sessions still cache in Redis with an in-memory fallback.

## Unknown outcomes

If create/issue times out and status lookup cannot confirm the result, the booking moves to `BOOKING_UNKNOWN` or `TICKETING_UNKNOWN`. Admin: **Resolve with supplier** (`POST /api/bookings/:id/resolve`). This never sends a second create/issue blindly.

## Mock scenarios

Set `MOCK_GDS_SCENARIO` (default `SUCCESS`):

`SUCCESS`, `PRICE_CHANGED`, `UNAVAILABLE`, `TIMEOUT`, `RATE_LIMIT`, `MALFORMED_RESPONSE`, `BOOKING_SUCCESS`, `BOOKING_TIMEOUT`, `BOOKING_FAILURE`, `TICKETING_SUCCESS`, `TICKETING_TIMEOUT`, `TICKETING_FAILURE`, `CANCEL_SUCCESS`, `CANCEL_TIMEOUT`, `CANCEL_FAILURE`, `VOID_SUCCESS`, `VOID_FAILURE`.

Timeout mutating scenarios persist the PNR/tickets/cancel **then** hang so lookup can recover.

## Adding a real GDS later

1. Keep `FLIGHT_PROVIDER=mock` until you have credentials.
2. Implement an adapter that maps vendor payloads to normalized types:

```ts
class RealGDSAdapter implements FlightProviderPort {
  readonly id = "vendor-id";
  readonly capabilities = DEFAULT_CAPABILITIES;
  async search(request) { /* map vendor offers → FlightOffer */ }
  async revalidate(offer) { /* same normalized shape */ }
  async createBooking(request) { /* use request.idempotencyKey */ }
  async getBookingStatus(request) { /* lookup by PNR or bookingId */ }
  async issueTicket(request) { /* never invent ticket numbers locally */ }
  async voidTicket(request) { /* … */ }
  async cancelBooking(request) { /* … */ }
  async getFareRules(offerId) { /* … */ }
  async getSeatMap(offerId) { /* … */ }
}
```

3. Register it in `router.ts` for `sandbox` / `production` only. Put credentials in env — never in git, logs, or the UI.
4. Do not change React, booking, payment, or ticketing domain rules. The instrumented gateway already wraps timeouts, circuit, and idempotency.

Admin health: http://localhost:3001/integrations/flights
