# ONETRIPS

Enterprise travel booking platform. Turborepo modular monolith.

## Apps

| App | URL | Role |
| --- | --- | --- |
| `@onetrips/web` | http://localhost:3000 | Customer website |
| `@onetrips/admin` | http://localhost:3001 | Operations console |
| `@onetrips/b2b` | http://localhost:3002 | Agency portal (search, book, wallet) |

## Setup

```bash
docker compose up -d
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

`npm run dev` starts the customer app. Use `npm run dev:all` for web, admin, and B2B together.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md).

## Auth (Phase 2)

| Portal | URL |
| --- | --- |
| Customer signup / login | `/signup`, `/login/customer` |
| B2B agent | `/register`, `/login`, `/dashboard` |
| Admin | http://localhost:3001/login (password + email OTP) |

Set `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` in `.env`, then run `npm run db:seed` to create the first Super Admin. In development, OTP codes are printed in the server console.

## Catalog (Phase 3)

Seeded IATA airports, airlines, countries, and a mock GDS supplier. Admin CRUD: `http://localhost:3001/catalog/airports`. Public search: `GET /api/catalog/airports?q=DAC`.

## Customer portal (Phase 4)

Signed-in customers use `/account` for profile, saved travelers, password change, and phone OTP verification. Passports are encrypted at rest. Set `ENCRYPTION_KEY` to a 64-character hex string in production; development falls back to a local-only key. OTP codes print in the server console.

## Flight search (Phase 5)

Home-page search submits origin/destination/dates to `/flights`. Results come from `@onetrips/flight-search` through `FlightProviderPort` (mock GDS adapter today). Fare payloads live in Redis for 20 minutes (`REDIS_URL`); PostgreSQL stores session metadata only. Filters and sort run in the domain package, not in the UI.

## Booking engine (Phase 6)

Selecting a fare on `/flights/review` creates a booking that follows the shared state machine: selected → revalidating → price confirmed (or changed / unavailable) → passengers → payment pending. Domain logic lives in `@onetrips/booking`. Sign-in is required.

## Payment gateway (Phase 7)

Checkout pay on `/booking/[id]` initiates a payment through `@onetrips/payments` (`PaymentProviderPort`, mock adapter today). The sandbox at `/pay/sandbox` stands in for SSLCommerz / bKash. Success webhooks credit the customer ledger (`PAY-{paymentId}`) and move the booking to `BOOKED` with a mock PNR. Set `PAYMENT_WEBHOOK_SECRET` in production. E-tickets are issued automatically after a successful PNR.

## E-tickets (Phase 8)

When a booking reaches `BOOKED`, `@onetrips/ticketing` calls the flight provider `issueTicket` port, writes `Ticket` rows, builds a PDF (`pdf-lib`), and emails it through `@onetrips/notifications`. Locally the console adapter prints the message; set `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` for real SMTP. Download: `/api/bookings/[id]/tickets/[ticketNumber]/pdf`.

## B2B agency portal (Phase 9)

Agency workspace runs at http://localhost:3002 (`npm run dev:b2b`). Login/register, search, wallet debit bookings, credit, ledger, invoices, and team live in the existing domain packages. `organizationId` is taken from the authenticated membership, never from the browser. B2B settlement uses `payWithOrganizationWallet` (wallet/credit debit replaces the gateway). Admin credit/deposit/status: http://localhost:3001/agencies. Seed a demo agency with `B2B_BOOTSTRAP_EMAIL` and `B2B_BOOTSTRAP_PASSWORD`.

## Pricing + invoices (Phase 10)

Search and booking quotes run through `@onetrips/pricing`. Active markup (specificity + priority) and service-fee rules are applied on supplier net; B2C defaults to 5% + ৳300 after seed. Ticketed bookings get an idempotent invoice (`INV-YYYYMMDD-XXXX`) and PDF from `@onetrips/finance`. Customer download: `/api/bookings/[id]/invoice/pdf`. Admin rules: http://localhost:3001/pricing. Invoices: http://localhost:3001/invoices and http://localhost:3002/invoices.

## Admin console (Phase 11)

The operations console at http://localhost:3001 (`npm run dev:admin`) lists bookings, customers, payments, invoices, agencies, pricing, reports, admin users, audit, and settings. Domain logic lives in `@onetrips/ops` plus the existing booking/customer/auth packages. Ticket issue from a booking detail requires `ticket.issue`. User management requires `user.manage` (Super Admin only can assign Super Admin). Cancel/void/refund live on the booking detail (`booking.cancel` / `booking.refund`). Reconciliation is at http://localhost:3001/reconciliation.

## Notifications + queue (Phase 12)

Email and SMS go through `@onetrips/notifications`. Jobs are pushed to Redis (`ot:notify:queue`) and drained by `npm run worker` (also started with `npm run dev:all`). If Redis is down, messages send inline in the API process. Console adapters print locally; set `SMTP_HOST` / `SMS_API_URL` for real providers. OTP, payment receipts, e-tickets, and ticketed SMS use the queue. Failed jobs retry with backoff (5 attempts). Admin: http://localhost:3001/notifications.

## Cancellation, refund, reconciliation (Phase 13)

Customers cancel from `/booking/[id]` (`POST /api/bookings/[id]/cancel`). Unpaid holds go to `CANCELLED` and open payments expire. After capture, `@onetrips/refunds` voids issued tickets, calls the flight provider `cancelBooking` port (mock succeeds), voids invoices, refunds through `PaymentProviderPort.refund`, and posts append-only ledger reversals (`RF-{paymentId}-n` debit against the original `PAY-` credit). Failed PNRs (`BOOKING_FAILED`) refund without a supplier cancel. Partial refunds leave the booking `REFUND_PENDING` until the remaining capture is settled. Admin: cancel/refund on the booking detail; exceptions at http://localhost:3001/reconciliation.

## GDS-ready hardening (Phase 14A)

The mock flight adapter remains the only provider. Search, booking, ticketing, and cancel go through `FlightProviderPort` with timeouts, a safe retry policy, PostgreSQL idempotency (`ProviderOperation`), a circuit breaker, and structured logs. Timeouts that the airline may already have processed are resolved with `getBookingStatus` — the platform does not create a second PNR or ticket. Unconfirmed outcomes use `BOOKING_UNKNOWN` / `TICKETING_UNKNOWN`. Admin: http://localhost:3001/integrations/flights. Contract: [docs/FLIGHT-PROVIDER.md](docs/FLIGHT-PROVIDER.md). `FLIGHT_PROVIDER=mock` only. Do not set real GDS credentials.

## B2B booking, backups, B2C E2E (Phase 14D)

B2B search/book uses the same flight-search, pricing, booking, ticketing, and invoice engines as B2C. Organization wallet/credit debit is the B2B settlement path. Automated PostgreSQL backups: `npm run backup`, restore drill `npm run backup:drill`. See [docs/BACKUP.md](docs/BACKUP.md). Offsite backup is still a production blocker. Playwright B2C journey: `npm run test:e2e` with `MOCK_GDS_SCENARIO=SUCCESS` and the mock payment sandbox.

## Hotel module (Phase 15)

Home-page Hotels tab searches destination / check-in / check-out through `@onetrips/hotel-search` (`HotelProviderPort`, mock adapter today). Room payloads live in Redis (`ot:hotel:{sessionId}`); PostgreSQL stores `HotelSearchSession` metadata only. Selecting a room creates a `Booking` with `type: HOTEL` and reuses the existing pricing, booking state machine, payments, wallet, voucher PDF, invoice, and refund engines. B2B search at http://localhost:3002/search has a Hotels tab. Contract: [docs/HOTEL-PROVIDER.md](docs/HOTEL-PROVIDER.md). `HOTEL_PROVIDER=mock` only. Do not set real hotel API keys.

## Production hardening (Phase 16)

Shared package `@onetrips/observability`: Redis sliding-window rate limits, pino logs, optional Sentry, `GET /api/health`, CSP/security headers, and a production env assert (placeholder JWTs, MySQL URLs, and non-mock providers fail closed). CI: `.github/workflows/ci.yml`. Load smoke: `npm run load:search`. Security notes: [docs/SECURITY.md](docs/SECURITY.md). Launch checklist: [docs/LAUNCH.md](docs/LAUNCH.md).

## Production acceptance & disaster recovery (Phase 17)

PostgreSQL dumps include SHA-256 sidecars and an optional offsite copy (`BACKUP_OFFSITE_DIR` or rclone). Production cron must set `BACKUP_OFFSITE_REQUIRED=YES` to a **different failure domain**. Restore drill: `npm run backup:drill`. Acceptance gate: `BACKUP_OFFSITE_DIR=... npm run accept`. Runbook: [docs/DR.md](docs/DR.md). Same-host `./backups` is not disaster recovery. A real GDS or hotel supplier has not started.





#   o n e t r i p s  
 