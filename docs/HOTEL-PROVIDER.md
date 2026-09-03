# Hotel provider contract (Phase 15)

ONETRIPS talks to hotel suppliers only through `HotelProviderPort` in `@onetrips/hotel-search`. Customer, B2B, and admin UIs never call a hotel API. Domain packages consume **normalized** offers, bookings, and vouchers.

## Architecture

```text
Hotel UI (web, B2B)
  → @onetrips/hotel-search (HotelProviderPort + MockHotelAdapter)
  → existing @onetrips/pricing
  → existing @onetrips/booking (type HOTEL)
  → existing payments / finance / ticketing / refunds
```

There is no second booking, payment, pricing, or refund engine. Hotel stays reuse the same state machine as flights.

Provider selection is `getHotelProvider()` in `packages/hotel-search/src/router.ts`. `HOTEL_PROVIDER=mock` is the only supported mode. `sandbox` / `production` fail fast until a real adapter exists. Do not put hotel API keys in this environment.

## HotelProviderPort

```ts
search, revalidate, createBooking, getBookingStatus, issueVoucher, cancelBooking
```

Request/response types live in `packages/hotel-search/src/types.ts`. Do not leak raw vendor JSON past the adapter.

Search session metadata is stored in PostgreSQL (`HotelSearchSession`). Room offers live in Redis (`ot:hotel:{sessionId}`) with an in-memory fallback, matching flights.

## Mock scenarios

Set `MOCK_HOTEL_SCENARIO` (default `SUCCESS`):

`SUCCESS`, `PRICE_CHANGED`, `UNAVAILABLE`.

## Adding a real hotel supplier later

1. Keep `HOTEL_PROVIDER=mock` until you have credentials.
2. Implement an adapter that maps vendor payloads to `HotelOffer` and the booking/voucher types.
3. Register it in `packages/hotel-search/src/router.ts` only after the adapter exists.
