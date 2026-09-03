# ONETRIPS Customer Platform Audit (Phase C0)

Date: 2026-08-24
Scope: full repository audit of the customer-facing product versus the enterprise B2C target (ShareTrip / GoZayaan product depth, used as UX references only).

Companion documents:

- [CUSTOMER-PLATFORM-GAP-ANALYSIS.md](CUSTOMER-PLATFORM-GAP-ANALYSIS.md) — itemized gaps with severity
- [CUSTOMER-PLATFORM-ROADMAP.md](CUSTOMER-PLATFORM-ROADMAP.md) — target state, phases, acceptance criteria

---

## 1. Executive summary

ONETRIPS has a **mature, production-hardened backend** (17 completed phases) and a **functional but shallow customer product surface**.

The commerce spine works end to end today: search (flight and hotel, mock providers) → fare/room selection → review → booking creation via the shared state machine → passenger capture → payment (mock gateway, idempotent, webhook-verified) → PNR → e-ticket / hotel voucher PDF → invoice PDF → cancel → refund with ledger reversal. IDOR protection, rate-limited auth, CSP, audit, backups, and a Playwright flight journey all exist.

What is missing is the **product around the spine**: no forgot-password flow, no global navigation or footer (links are `#` placeholders), no mobile navigation, no hotel details page, no price breakdown at checkout, no promotions, no My Trips organization, no payments/invoices/notifications/preferences/support pages in the account portal, no SEO or public content pages, and the design-system components in `packages/ui` are never imported by any page.

**Conclusion:** this is a UX/product completion project on top of a sound architecture. Roughly 80% of the work is UI in `apps/web` reusing existing domain packages; the remaining 20% is four genuinely missing domain capabilities (promotions, support, notification inbox, preferences) plus small auth/profile schema additions — each requiring a schema-change approval gate.

## 2. Technology facts (verified)

- Turborepo modular monolith: `apps/web` (3000), `apps/admin` (3001), `apps/b2b` (3002); 18 packages under `packages/`.
- **Next.js 16.2.6**, React 19, Tailwind v4 (`@theme` tokens, no tailwind.config). `proxy.ts` replaces `middleware.ts` — all three apps use it. No Server Actions anywhere; everything is route handlers + client fetch.
- **PostgreSQL is the only application database.** `provider = "postgresql"` in `packages/database/prisma/schema.prisma`; runtime guards reject MySQL URLs (`packages/database/src/assert-url.ts`, `packages/observability/src/env.ts`). MySQL exists only as an archived migration folder (`prisma/migrations-mysql-archive/`) and legacy tooling under `scripts/legacy-mysql/`.
- Redis: fare/room session payloads, notification queue, rate limits. PostgreSQL stores session metadata only.
- Provider ports intact: `FlightProviderPort`, `HotelProviderPort`, `PaymentProviderPort`, notification adapters. All routed to mock adapters; production env assert fails closed on non-mock providers.
- Money: Prisma `Decimal` columns; domain code uses `Number` + `Math.round` (see gap G-33).

## 3. Area-by-area classification

Legend: EXISTS (production-quality) / EXISTS-UX (exists, needs UX improvement) / EXISTS-INC (exists, incomplete) / PARTIAL / MISSING / BACKEND ONLY / UI ONLY.

### 3.1 Identity and authentication

| Capability | Backend | UI | Classification |
| --- | --- | --- | --- |
| Customer registration | EXISTS (`registerCustomer`, PENDING → email OTP → ACTIVE) | `/signup` basic form | EXISTS-UX (no confirm password, T&C, privacy, consent) |
| Login / logout / sessions | EXISTS (JWT cookies `ot_access`/`ot_refresh`, rotation, lockout 5/15min, rate limits) | `/login/customer` | EXISTS-UX |
| Email verification | EXISTS (OTP purpose REGISTER) | Embedded in signup only | PARTIAL (no standalone page; no `emailVerifiedAt` on User) |
| Phone verification | EXISTS (OTP) | `/account/settings` | EXISTS-INC (not surfaced in onboarding) |
| Forgot / reset password | PARTIAL (OTP purpose RESET exists; **no reset-completion flow** in `packages/auth/src/service.ts`) | MISSING (`Forgot?` links to `#`) | **PARTIAL — top gap** |
| MFA (admin) | EXISTS | EXISTS | EXISTS |
| RBAC | EXISTS (Role/Permission, scopes PLATFORM/B2B/CUSTOMER) | n/a | EXISTS |

### 3.2 Customer shell and navigation

| Capability | Classification | Notes |
| --- | --- | --- |
| Global header/footer | MISSING | Each page re-implements a slim brand bar; footer links are `#` |
| Account menu | PARTIAL | `AccountShell` pill tabs (Overview, Bookings, Profile, Travelers, Settings) |
| Mobile bottom navigation | MISSING | No bottom tab bar anywhere |
| Homepage | EXISTS (locked design) | Flights/Hotels tabs, one-way/round-trip/multi-city; free-text airport inputs; no pax/cabin controls |
| `packages/ui` adoption | UI ONLY | `BrandLogo`, `Button`, `Input`, `Card`, `Alert`, `SearchField` exported but never imported by pages; tokens CSS is imported |

### 3.3 Flight experience

| Capability | Backend | UI | Classification |
| --- | --- | --- | --- |
| Search (OW/RT/multi-city ≤6 legs) | EXISTS (`@onetrips/flight-search`, Redis sessions ~20min, revalidation) | EXISTS | EXISTS |
| Results page `/flights` | EXISTS | Strongest page: AirportPicker, filters (stops, airline, depart period, refundable, max price), 4 sorts, baggage/brand/refundability/seats, expiry, empty/error states | EXISTS-UX |
| Filters: arrival time, duration, baggage, fare family | PARTIAL (domain facets exist for some) | MISSING | PARTIAL |
| Fare selection / brand matrix | PARTIAL (brandedFare on offers) | Single Select button | EXISTS-UX |
| Review `/flights/review` | EXISTS (revalidate + quote) | Base/taxes in API types but **not rendered** | EXISTS-UX |
| Multi-city modify on results | EXISTS | Results form is OW/RT-oriented | PARTIAL |

### 3.4 Hotel experience

| Capability | Backend | UI | Classification |
| --- | --- | --- | --- |
| Search | EXISTS (`@onetrips/hotel-search`, catalog destination resolve, Redis sessions) | Free-text city, rooms/guests | EXISTS-UX |
| Results `/hotels` | EXISTS | Sort + refundable + minStars only; `amenities[]` never rendered | EXISTS-UX |
| Hotel details page (gallery, amenities, policies, rooms) | PARTIAL (details embedded per offer; no grouped hotel-details API) | MISSING | **MISSING — top gap** |
| Filters: price range, amenities, breakfast, property type | MISSING (domain facets thin) | MISSING | MISSING |
| Room selection → booking | EXISTS (offer = room rate; reuses shared `Booking`, `type: HOTEL`) | `/hotels/review` thin | EXISTS-INC |
| Voucher | EXISTS (`buildHotelVoucherPdf`) | Download on booking page | EXISTS |

### 3.5 Booking, checkout, payment

| Capability | Backend | UI | Classification |
| --- | --- | --- | --- |
| Booking state machine (23 states) | EXISTS (`packages/shared/src/booking-states.ts`, enforced in `packages/booking`) | `/booking/[id]` handles all states incl. PRICE_CHANGED accept, EXPIRED, UNAVAILABLE, retry | EXISTS |
| Passenger capture + saved travelers | EXISTS (age rules, passport encryption AES-256-GCM) | EXISTS | EXISTS |
| Price breakdown (base/taxes/markup/fee/discount) | EXISTS (pricing engine + Booking money columns) | **Not rendered** — only total shown | BACKEND ONLY |
| Promo codes / campaigns | MISSING (`discount = 0` hardcoded in `packages/pricing/src/engine.ts`; no models) | MISSING | **MISSING — needs domain + DB** |
| Payment (idempotent, webhook HMAC, attempts, sandbox) | EXISTS | Method buttons (Card/bKash/Nagad), full state handling, polling | EXISTS |
| Payment history page | EXISTS (data in Payment/LedgerEntry) | MISSING | BACKEND ONLY |

### 3.6 Post-booking

| Capability | Backend | UI | Classification |
| --- | --- | --- | --- |
| E-ticket PDF | EXISTS | Download | EXISTS |
| Hotel voucher PDF | EXISTS | Download | EXISTS |
| Invoice PDF | EXISTS (idempotent `INV-YYYYMMDD-XXXX`) | Download on booking page only | EXISTS |
| Invoices list page | EXISTS (`listInvoices`) | MISSING | BACKEND ONLY |
| Cancel | EXISTS (`cancelBookingForCustomer`: void tickets, supplier cancel, void invoices) | EXISTS | EXISTS |
| Refund | EXISTS (partial refunds, ledger reversals `RF-`, reconciliation) | Status shown; no dedicated refund-tracking view | EXISTS-UX |
| My Trips organization (upcoming/completed/cancelled/refunds) | EXISTS (data) | Flat list at `/account/bookings` | EXISTS-UX |
| Booking history timeline / payments list on detail | EXISTS (`BookingStatusHistory`, `payments[]` in API types) | Not rendered | BACKEND ONLY |

### 3.7 Account portal

| Page | Classification |
| --- | --- |
| `/account` overview | EXISTS-INC (name, verify badge, traveler count, one trip snippet — not a dashboard) |
| `/account/bookings` | EXISTS-UX (flat list) |
| `/account/profile` | EXISTS-UX (no photo, address, email/phone management) |
| `/account/passengers` (travelers) | EXISTS (CRUD, masking, encryption; no expiry warnings, no preferred flag) |
| `/account/settings` | EXISTS-INC (phone OTP + password only) |
| Payments / Invoices / Notifications / Preferences / Support pages | MISSING |

### 3.8 Notifications

- Email + SMS via `@onetrips/notifications` (console/SMTP/SMS adapters), Redis queue, retry x5, templates in DB. **EXISTS.**
- In-app inbox: MISSING. `NotificationLog` is an outbound delivery audit (no read state, title, deep link). PUSH channel throws NOT_IMPLEMENTED.

### 3.9 Support

- MISSING entirely: no models, no pages, no APIs. Only a `SUPPORT_EMAIL` SystemConfig and a platform SUPPORT role.

### 3.10 SEO, content, accessibility, i18n

- Root metadata title/description only. No per-route metadata, sitemap, robots, OpenGraph, JSON-LD. **MISSING.**
- Public content pages (`/about`, `/terms`, `/privacy`, `/faq`, `/offers`, `/destinations`, contact): **MISSING** (footer `#` placeholders).
- Accessibility: mixed labels (many placeholder-only fields), essentially no ARIA, `Alert` with `role="alert"` exists but unused, mouse-oriented AirportPicker. **EXISTS-INC.**
- i18n: none; hardcoded `en-US`/`en-GB` formatting. Architecture prep MISSING.

### 3.11 Security posture (customer surface)

Strengths (verified): consistent `requireCustomer` + package-level ownership (`assertCanAccessBooking`, traveler `where: { id, customerId }`) — no customer endpoint found loading by id without ownership; webhook HMAC (`timingSafeEqual`) + event idempotency; httpOnly/Lax/secure cookies; CSP nonce + security headers via `proxy.ts`; production env fail-closed; pino secret redaction; no secrets in `NEXT_PUBLIC_*`.

Gaps: no route-level rate limits on cancel/refund/ticket-issue/pay-verify/password/profile writes; no CSRF Origin checks beyond SameSite=Lax; B2B registration uploads written under `public/uploads` with original filenames (also exposed via legacy `/api/register` on the customer app); unauthenticated search-session capability URLs; legacy `Agent` table with plaintext `password` column; `/api/payments/verify` skips its zod schema.

### 3.12 Testing

- E2E (Playwright, Chromium only, port 3100): full B2C flight journey incl. register→OTP→book→pay→ticket→invoice→trips + DB asserts; payment-declined + retry; cross-customer IDOR (403 on booking/ticket/invoice); security headers/health; hotel **search smoke only**.
- Missing E2E: hotel book→pay→voucher, price-changed/fare-unavailable UI journeys, refund/cancel journeys, mobile viewport project.
- Unit/integration: ~20 unit + 5 integration files; strongest in `flight-search`; **zero tests** in `ticketing`, `pricing`, `notifications`, `catalog`, `ops`, `ui`.
- CI runs migrate/seed/unit/integration/builds/backup-drill/accept/E2E against Postgres 16 + Redis 7.

## 4. What must NOT change

- Booking, payment, pricing, refund, ticketing engines and the 23-state machine.
- Provider ports and mock adapters as the only providers.
- PostgreSQL provider, append-only ledger, idempotency (Payment.idempotencyKey, ProviderOperation, webhook events).
- RBAC, admin and B2B apps, `proxy.ts` gating, CSP/security headers, audit logging.
- The approved homepage design (`apps/web/app/page.tsx` is the visual source of truth per docs/DESIGN-SYSTEM.md).
