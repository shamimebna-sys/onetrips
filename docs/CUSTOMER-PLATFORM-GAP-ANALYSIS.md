# ONETRIPS Customer Platform Gap Analysis

Date: 2026-08-24. Derived from [CUSTOMER-PLATFORM-AUDIT.md](CUSTOMER-PLATFORM-AUDIT.md). Phases refer to [CUSTOMER-PLATFORM-ROADMAP.md](CUSTOMER-PLATFORM-ROADMAP.md).

Severity: CRITICAL (blocks core customer journey or is a security exposure) / HIGH (major product-depth gap vs OTA baseline) / MEDIUM (polish, depth, trust) / LOW (deferred).

---

## Authentication and registration

### G-01 Forgot / reset password
- Area: Auth
- Current state: OTP purpose `RESET` can be issued/verified (`packages/auth/src/service.ts`), but there is no set-new-password completion and no UI. `Forgot?` links point to `#`.
- Expected enterprise state: `/forgot-password` → OTP → `/reset-password` with strength rules, session revocation on reset, rate limiting, generic success messaging (no account enumeration).
- Severity: CRITICAL
- Business impact: locked-out customers churn; support burden.
- Technical impact: small auth-package addition + two pages.
- Existing reusable code: `requestOtp`/`verifyOtp`, `OtpChallenge`, `changePassword` hashing, auth rate limits.
- Required UI: `/forgot-password`, `/reset-password` pages; link from login.
- Required backend/domain change: `resetPasswordWithOtp` in `@onetrips/auth` (verify RESET OTP → set hash → revoke sessions).
- Database change required?: No (OtpChallenge suffices).
- API change required?: New `/api/auth/password/forgot` + `/api/auth/password/reset` (additive).
- Security implications: enumeration-safe responses, OTP rate limits, session revocation.
- Testing required: unit (auth), E2E (reset journey, lockout on abuse).
- Recommended phase: C2

### G-02 Registration UX and consent
- Area: Auth
- Current state: `/signup` has first/last/email/phone/password only; placeholder-only labels; no confirm password, T&C, privacy acknowledgement, or marketing consent.
- Expected enterprise state: full registration form per spec (confirm password, T&C checkbox, privacy acknowledgement, optional marketing consent), proper labels/error states.
- Severity: HIGH
- Business impact: legal/compliance baseline; trust at first touch.
- Technical impact: form rework + one schema field.
- Existing reusable code: `registerCustomer`, zod schemas, OTP flow.
- Required UI: rebuilt `/signup`; standalone `/verify` step with resend cooldown UI.
- Required backend/domain change: accept consent fields in register schema.
- Database change required?: **Yes (approval gate)** — `User.emailVerifiedAt`, `Customer.marketingConsentAt` (nullable, additive).
- API change required?: additive fields on register.
- Security implications: none beyond existing.
- Testing required: unit + register E2E update.
- Recommended phase: C2

### G-03 Post-verification welcome / profile completion
- Area: Onboarding
- Current state: verification jumps straight to `/account`.
- Expected enterprise state: welcome screen with optional profile fields (DOB, gender, nationality, country, address, city, photo) and Continue / Skip for now; never blocks booking.
- Severity: MEDIUM
- Business impact: profile completeness improves checkout speed.
- Technical impact: one page; profile PATCH exists.
- Existing reusable code: `/api/account/profile` PATCH, customer schemas.
- Required UI: `/welcome` (or `/account/complete-profile`).
- Required backend/domain change: none for existing fields; address/photo need G-22.
- Database change required?: only via G-22.
- API change required?: No.
- Security implications: none.
- Testing required: E2E skip path.
- Recommended phase: C2

## Shell and navigation

### G-04 Global customer shell (header, footer, account menu)
- Area: Navigation
- Current state: no shared chrome; every page re-implements a brand bar; footer links are `#`; no account dropdown.
- Expected enterprise state: shared header (Flights, Hotels, Offers, My Trips, Help, Notifications, Account menu) and real footer, per spec section 8; homepage keeps its locked design.
- Severity: HIGH
- Business impact: currently feels like disconnected modules, not one product.
- Technical impact: shared layout components in `packages/ui` + adoption across pages.
- Existing reusable code: `packages/ui` primitives + tokens (currently unused by pages).
- Required UI: `SiteHeader`, `SiteFooter`, `AccountMenu` components; wire into layouts.
- Required backend/domain change: none.
- Database change required?: No. API change required?: No.
- Security implications: none.
- Testing required: E2E nav smoke; a11y checks.
- Recommended phase: C1

### G-05 Mobile bottom navigation
- Area: Navigation / mobile
- Current state: none; homepage mid-nav hidden on mobile with no replacement.
- Expected enterprise state: fixed bottom tabs — Home, Search, Trips, Offers, Account — on customer pages.
- Severity: HIGH
- Business impact: OTA traffic is mobile-majority.
- Technical impact: one component + layout integration.
- Existing reusable code: tokens.
- Required UI: `MobileTabBar` in `packages/ui`.
- Required backend/domain change: none. Database/API: No.
- Security implications: none.
- Testing required: mobile-viewport E2E.
- Recommended phase: C1

### G-06 Design-system adoption
- Area: UI consistency
- Current state: `packages/ui` components exported but never imported by pages; duplicated inline Tailwind everywhere.
- Expected enterprise state: pages consume shared components; consistent focus states and a11y baked in once.
- Severity: MEDIUM
- Business impact: inconsistent look erodes trust.
- Technical impact: incremental refactor while touching each page.
- Existing reusable code: `Button`, `Input`, `Card`, `Alert`, `SearchField`, `BrandLogo`.
- Required UI: adopt + extend kit (Select, Modal, Tabs, Badge, Skeleton, EmptyState, Stepper).
- Database/API: No.
- Security implications: none.
- Testing required: none dedicated.
- Recommended phase: C1 (kit), ongoing per phase

## Dashboard

### G-07 Customer dashboard
- Area: `/account`
- Current state: thin overview (name, phone badge, traveler count, one trip snippet).
- Expected enterprise state: travel dashboard per spec section 11 — hero, quick-booking tabs (flight/hotel search), Upcoming Trip card, Recent Trips, Saved Travelers, Recent Searches, Invoices, Notifications, Support shortcuts.
- Severity: HIGH
- Business impact: repeat-booking engagement hub.
- Technical impact: composition of existing APIs; recent searches needs G-24.
- Existing reusable code: `/api/account/bookings`, passengers API, search forms.
- Required UI: rebuilt `/account`.
- Required backend/domain change: none (recent searches deferred to G-24).
- Database/API: No (dashboard aggregate endpoint optional, additive).
- Security implications: ownership already enforced.
- Testing required: E2E dashboard render.
- Recommended phase: C3

## Flights

### G-08 Homepage/search form fidelity
- Area: Flight search entry
- Current state: free-text 3-char airport inputs; no passengers/cabin on homepage; hotel destination free text. Homepage visual design is locked.
- Expected enterprise state: airport autocomplete, passenger (ADT/CHD/INF) + cabin selectors, within the approved visual design.
- Severity: HIGH
- Business impact: search conversion; malformed searches.
- Technical impact: reuse `AirportPicker`; behavior-only change to locked layout (needs owner sign-off on any visual delta).
- Existing reusable code: `apps/web/app/flights/AirportPicker.tsx`, `/api/catalog/airports`.
- Required UI: upgrade homepage + `/flights` modify forms.
- Database/API: No.
- Security implications: none.
- Testing required: E2E search entry.
- Recommended phase: C4

### G-09 Results depth: filters, sorting, breakdown
- Area: `/flights`
- Current state: stops/airline/depart-period/refundable/max-price filters, 4 sorts; no arrival-time, duration, baggage, or fare-family filters; no per-offer base/tax display.
- Expected enterprise state: full filter set + price breakdown visibility per spec section 12.
- Severity: MEDIUM
- Business impact: parity with OTA filtering expectations.
- Technical impact: extend `packages/flight-search/src/filters.ts` facets (domain, not UI).
- Existing reusable code: filter/sort engine, facets.
- Required UI: filter sidebar extensions, mobile filter drawer.
- Required backend/domain change: additive filter fields in flight-search schemas.
- Database change required?: No. API change required?: additive query params.
- Security implications: none.
- Testing required: unit (filters), E2E filter application.
- Recommended phase: C4

### G-10 Fare review transparency + fare families
- Area: `/flights/review`
- Current state: base/taxes present in API types but not rendered; single Select (no brand upsell matrix).
- Expected enterprise state: itinerary + full fare breakdown + fare-family comparison where offers carry brands.
- Severity: HIGH
- Business impact: price transparency is a trust requirement (spec section 15).
- Technical impact: render existing data; group sibling branded offers.
- Existing reusable code: pricing quote output, offer payloads.
- Required UI: breakdown panel, brand matrix.
- Database/API: No.
- Security implications: none.
- Testing required: E2E review shows breakdown.
- Recommended phase: C4

### G-11 Multi-city modify on results
- Area: `/flights`
- Current state: initial multi-city search works from homepage; results modify form is OW/RT-only.
- Expected enterprise state: modify search supports all trip types.
- Severity: MEDIUM. Business impact: dead-end UX. Technical impact: form state only.
- Existing reusable code: multi-city schema (≤6 segments).
- Required UI: results search form. Backend/DB/API: No.
- Security implications: none. Testing: E2E multi-city.
- Recommended phase: C4

## Hotels

### G-12 Hotel details page
- Area: Hotel product
- Current state: no `/hotels/[id]`; offers are flat room-rate cards; `amenities[]` never rendered; no gallery/policies/location view.
- Expected enterprise state: hotel details with gallery, overview, room list (offers grouped by hotel), amenities, policies, cancellation terms per spec section 13.
- Severity: HIGH
- Business impact: hotel conversion depends on a details page; currently not a credible hotel product.
- Technical impact: domain addition to group session offers by hotel + details payload from provider port (mock already returns details per offer).
- Existing reusable code: `getHotelOffer`, `HotelProviderPort`, session storage.
- Required UI: `/hotels/[hotelId]?session=...` details + room selection.
- Required backend/domain change: `getHotelDetails(sessionId, hotelId)` in `@onetrips/hotel-search` grouping offers (no new engine).
- Database change required?: No (Redis session data only).
- API change required?: new additive `/api/hotels/sessions/[id]/hotels/[hotelId]`.
- Security implications: same session-token model as today.
- Testing required: unit (grouping), E2E details → room → book.
- Recommended phase: C5

### G-13 Hotel filters and facets
- Area: `/hotels`
- Current state: sort + refundable + minStars only.
- Expected enterprise state: price range, stars, breakfast/board, free cancellation, amenities, property type per spec.
- Severity: MEDIUM
- Business impact: filtering is baseline OTA behavior.
- Technical impact: extend hotel-search filter engine + facets (domain).
- Existing reusable code: flight-search facet pattern.
- Required UI: filter sidebar + mobile drawer.
- Required backend/domain change: additive filters in `@onetrips/hotel-search`.
- Database/API: No / additive params.
- Security implications: none. Testing: unit + E2E.
- Recommended phase: C5

### G-14 Hotel destination autocomplete
- Area: Hotel search entry
- Current state: free-text city input.
- Expected enterprise state: destination typeahead against city/airport catalog.
- Severity: MEDIUM. Impact: conversion.
- Existing reusable code: catalog city/country APIs, AirportPicker pattern.
- Required UI: DestinationPicker. Backend: optional city-search endpoint (additive).
- Database: No. Security: none. Testing: E2E.
- Recommended phase: C5

## Checkout, pricing, promotions

### G-15 Checkout price breakdown
- Area: `/booking/[id]`
- Current state: only `fare.totalLabel` shown; Booking rows already store supplierCost/markup/serviceFee/discount.
- Expected enterprise state: itemized breakdown (base fare, taxes, service fee, discount, total) at review and checkout; never hide fees.
- Severity: HIGH
- Business impact: pricing transparency = trust + dispute reduction.
- Technical impact: render existing quote data; include breakdown in booking API response.
- Existing reusable code: pricing engine output, invoice line items.
- Required UI: PriceBreakdown component (shared with review pages).
- Backend/domain: expose breakdown in booking detail response (additive).
- Database: No. API: additive field. Security: none.
- Testing: E2E asserts breakdown totals.
- Recommended phase: C6

### G-16 Promotions architecture
- Area: Pricing / marketing
- Current state: MISSING everywhere — `discount = 0` hardcoded in `packages/pricing/src/engine.ts`; no promo models, no UI field, no admin CRUD.
- Expected enterprise state: promo codes + campaigns with rules (min amount, max discount, customer/airline/hotel/route eligibility, date window, global + per-customer usage limits) applied inside the pricing engine; promo field at checkout; `/offers` page listing active campaigns; admin CRUD.
- Severity: HIGH
- Business impact: campaigns are core OTA commerce; `/offers` nav is dead without it.
- Technical impact: largest new domain surface — new `packages/promotions` or a pricing-engine extension; must stay inside the pricing/quote path (no second pricing engine).
- Existing reusable code: rule-matching pattern from MarkupRule/ServiceFeeRule; `Booking.discountAmount`; invoice discount line.
- Required UI: promo input at checkout, `/offers` page, admin promotions CRUD.
- Required backend/domain change: promotion evaluation service invoked from pricing quote; redemption recording tied to booking lifecycle (release on cancel/failure).
- Database change required?: **Yes (approval gate)** — `Promotion` + `PromotionRedemption` models (additive).
- API change required?: additive apply/remove-promo endpoints + admin CRUD.
- Security implications: redemption race conditions (limits enforced transactionally), abuse rate limiting, no client-trusted discounts.
- Testing required: unit (eligibility/limits), integration (concurrent redemption), E2E (apply/invalid/expired), admin CRUD.
- Recommended phase: C6

## My Trips and booking detail

### G-17 My Trips organization
- Area: `/account/trips`
- Current state: flat `/account/bookings` list.
- Expected enterprise state: Upcoming / Completed / Cancelled / Refunds tabs; rich trip cards (route, dates, ref, status, amount); redirect from old path.
- Severity: HIGH
- Business impact: primary retention surface.
- Technical impact: status-group mapping over existing list API.
- Existing reusable code: `listBookings`, status label maps.
- Required UI: `/account/trips` with tabs + cards.
- Backend: additive status-group filter param. Database: No.
- Security: ownership enforced. Testing: E2E tabs.
- Recommended phase: C7

### G-18 Booking detail depth
- Area: `/booking/[id]`
- Current state: strong state handling, but no status-history timeline, no payments list, no cancellation-policy panel, no refund tracker.
- Expected enterprise state: premium itinerary page per spec section 18 with timeline, payment records, policy, refund status, downloads, state-gated actions.
- Severity: MEDIUM
- Business impact: reduces support contacts.
- Technical impact: render existing `history`/`payments[]` data.
- Existing reusable code: `BookingStatusHistory`, payment attempts, refund states.
- Required UI: timeline, payments panel, refund tracker.
- Database/API: No (data already returned or trivially additive).
- Security: none. Testing: E2E detail assertions.
- Recommended phase: C7

## Travelers, profile, preferences

### G-19 Traveler management depth
- Area: `/account/travelers`
- Current state: solid CRUD with encrypted passports and masking at `/account/passengers`; no expiry warnings, no preferred traveler, no frequent-flyer field.
- Expected enterprise state: spec section 19 — expiry warnings (<6 months), preferred traveler, FF number, rename route to `/account/travelers`.
- Severity: MEDIUM
- Business impact: checkout speed for repeat customers.
- Technical impact: small schema additions + UI.
- Existing reusable code: `SavedPassenger` CRUD, `maskPassport`, encryption.
- Required UI: enhanced traveler cards/forms; checkout picker already exists.
- Database change required?: **Yes (approval gate)** — `SavedPassenger.isPreferred`, `frequentFlyerNumber` (additive, nullable).
- API: additive fields. Security: keep encryption/masking; FF number masked.
- Testing: unit + E2E.
- Recommended phase: C8

### G-20 Profile completeness
- Area: `/account/profile`
- Current state: name/DOB/gender/nationality only; no address, city, photo; no email change; verification badges partial.
- Expected enterprise state: spec section 20 — personal + contact info, address, photo, email/phone verification badges.
- Severity: MEDIUM
- Business impact: invoicing/contact accuracy.
- Technical impact: schema additions + upload handling (reuse hardened upload path from G-30).
- Existing reusable code: profile PATCH, phone OTP.
- Database change required?: **Yes (approval gate)** — `Customer.addressLine1/2`, `city`, `postalCode`, `countryId?`, `photoUrl` (additive, nullable).
- API: additive. Security: photo upload validation (type/size/re-encode).
- Testing: unit + E2E. Recommended phase: C8

### G-21 Preferences
- Area: `/account/preferences`
- Current state: MISSING (no model, no page).
- Expected enterprise state: language (EN/BN-ready), currency display, notification channel opt-ins, marketing consent management.
- Severity: MEDIUM
- Business impact: i18n and consent foundation.
- Technical impact: small model + page; consumed by notifications enqueue.
- Database change required?: **Yes (approval gate)** — `CustomerPreference` (1:1 customer; locale, currency, channel opt-ins) — additive.
- API: new additive endpoints. Security: none beyond ownership.
- Testing: unit + E2E. Recommended phase: C8

## Payments, invoices, notifications

### G-22 Payment history page
- Area: `/account/payments`
- Current state: MISSING page; data exists (Payment, attempts, ledger).
- Expected enterprise state: history with booking ref, amount, currency, method, status, date, invoice link; no sensitive credentials (none stored).
- Severity: MEDIUM. Business impact: self-service trust.
- Existing reusable code: payment queries, `listAdminPayments` pattern.
- Required UI: page + detail rows. Backend: additive customer-scoped list API.
- Database: No. Security: ownership filter mandatory + IDOR test.
- Testing: E2E + IDOR. Recommended phase: C9

### G-23 Invoices page
- Area: `/account/invoices`
- Current state: invoice PDF only reachable from booking detail; `listInvoices` exists in finance.
- Expected enterprise state: list with number, booking, date, amount, status; view/download.
- Severity: MEDIUM. Impact: B2C receipts self-service.
- Existing reusable code: `@onetrips/finance` listInvoices + PDF.
- Required UI: page. Backend: additive customer-scoped list API. Database: No.
- Security: ownership + IDOR test. Testing: E2E.
- Recommended phase: C9

### G-24 In-app notification inbox
- Area: `/account/notifications`
- Current state: MISSING — `NotificationLog` is delivery audit only; PUSH throws NOT_IMPLEMENTED.
- Expected enterprise state: persisted per-user inbox (booking/payment/ticket/refund/promo events), unread badge in header, mark-read; written alongside existing queue sends via `NotificationPort` pattern.
- Severity: HIGH
- Business impact: core engagement surface; header bell is dead without it.
- Technical impact: new model + write hook in `@onetrips/notifications` enqueue path; no queue rewrite.
- Database change required?: **Yes (approval gate)** — `InAppNotification` (userId, type, title, body, deepLink, readAt) — additive.
- API: additive list/mark-read endpoints. Security: ownership; no OTP/secret content in payloads.
- Testing: unit + E2E badge/read. Recommended phase: C9

## Support

### G-25 Support foundation
- Area: `/help`, `/support`, `/account/support`
- Current state: MISSING entirely (only SUPPORT role + SUPPORT_EMAIL config).
- Expected enterprise state: FAQ, contact form, booking-linked support requests (refund/cancellation/ticket/hotel issue categories), request list + status for customer, admin queue view. No live chat yet.
- Severity: HIGH
- Business impact: unsupported customers cannot resolve booking problems; refund/cancel disputes have no channel.
- Technical impact: new small domain (`packages/support` or within ops) + customer/admin UI.
- Existing reusable code: notification queue (acknowledgement emails), booking ownership checks, AuditLog.
- Database change required?: **Yes (approval gate)** — `SupportRequest` (+ optional `SupportMessage` thread) — additive.
- API: new additive customer + admin endpoints.
- Security implications: booking association must verify ownership; rate limiting on creation; no sensitive data echo.
- Testing: unit, E2E create/track, IDOR.
- Recommended phase: C10

## SEO, content, performance, accessibility

### G-26 Public content and SEO
- Area: Marketing surface
- Current state: no `/about`, `/contact`, `/faq`, `/terms`, `/privacy`, `/refund-policy`, `/cancellation-policy`, `/offers`, `/destinations`; no sitemap/robots/OG/JSON-LD; root metadata only.
- Expected enterprise state: content routes with per-route `generateMetadata`, `sitemap.ts`, `robots.ts`, OpenGraph, structured data; private routes noindex.
- Severity: HIGH (organic acquisition + legal pages)
- Technical impact: static/server-rendered pages; no domain change.
- Required UI: content pages + footer wiring.
- Database/API: No. Security: private routes excluded from sitemap.
- Testing: metadata smoke tests. Recommended phase: C1 (legal/help stubs + footer), C12 (full SEO)

### G-27 Accessibility baseline
- Area: All pages
- Current state: placeholder-only labels widespread, no ARIA, unused `role="alert"` Alert, mouse-only AirportPicker, unmarked decorative SVGs.
- Expected enterprise state: labeled forms with error association, keyboard-operable pickers/dialogs, focus management, contrast-checked tokens, landmarks.
- Severity: HIGH
- Technical impact: fix once in `packages/ui`, adopt everywhere.
- Database/API: No. Testing: axe checks in E2E, keyboard-path tests.
- Recommended phase: C1 (component level) + C12 (audit pass)

### G-28 UX state consistency
- Area: All pages
- Current state: good booking-state coverage; weak hotel empty state; repetitive red banners; no skeletons; generic errors in places.
- Expected enterprise state: consistent Skeleton/EmptyState/ErrorState components with specific, actionable copy ("This fare is no longer available" + alternatives CTA).
- Severity: MEDIUM. Technical impact: shared components + copy pass.
- Database/API: No. Testing: E2E failure journeys (fare expired, price changed).
- Recommended phase: C1 (components), C13 (failure-state hardening)

## Security hardening

### G-29 Rate-limit coverage
- Area: API security
- Current state: search/booking-create/pay/auth are limited; cancel, refund, ticket-issue, pay-verify, `payments/verify`, password change, profile/passenger writes are not.
- Expected enterprise state: route-level limits on all state-changing customer endpoints; zod on `payments/verify`.
- Severity: HIGH. Technical impact: apply existing `RATE_LIMITS` helpers.
- Database/API: No. Testing: integration limit tests.
- Recommended phase: C13 (or earlier opportunistically)

### G-30 CSRF and upload hardening
- Area: API security
- Current state: SameSite=Lax only (no Origin checks); B2B registration uploads land in `public/uploads` with original filenames, also exposed via legacy `/api/register` on the customer app.
- Expected enterprise state: Origin/Sec-Fetch-Site checks on state-changing cookie-auth routes; uploads outside web root with random names, type/size validation; remove/redirect legacy alias routes.
- Severity: HIGH. Technical impact: shared guard helper + upload utility.
- Database/API: No contract change. Testing: integration.
- Recommended phase: C13

### G-31 Legacy cleanup
- Area: Hygiene
- Current state: legacy `Agent` model (plaintext password column), unused `apps/web/services/flightService.ts`, deprecated `/api/flights`, `/api/login`, `/api/register` aliases, dead `/dashboard` B2B pages in the customer app.
- Expected enterprise state: legacy surfaces removed or explicitly quarantined; customer app contains only customer product.
- Severity: MEDIUM (Agent plaintext column is dormant but should not survive)
- Database change required?: dropping `Agent` would be a schema change — **flag for approval, not required by this project**; default is leave untouched.
- Recommended phase: C13 (code-level cleanup only)

## Testing

### G-32 E2E coverage expansion
- Area: Testing
- Current state: flight happy path, payment declined, IDOR, headers/health, hotel search smoke; Chromium desktop only.
- Expected enterprise state: hotel full booking → voucher journey; price-changed, fare-unavailable, cancellation, refund journeys; mobile viewport project; new-surface IDOR (payments, invoices, notifications, support); axe accessibility checks.
- Severity: HIGH. Technical impact: specs + one Playwright mobile project; `MOCK_GDS_SCENARIO`/`MOCK_HOTEL_SCENARIO` already support failure simulation.
- Recommended phase: incremental per phase + C14 consolidation

### G-33 Unit coverage + money math
- Area: Testing / correctness
- Current state: zero unit tests in `ticketing`, `pricing`, `notifications`, `catalog`, `ops`, `ui`; money math is `Number` + `Math.round` (Prisma Decimal at rest).
- Expected enterprise state: pricing/promotions fully unit-tested; integer-minor-unit or decimal-string arithmetic helpers in `@onetrips/shared` used by pricing/promotions paths touched in this project.
- Severity: MEDIUM (HIGH for promotion math)
- Technical impact: shared money helper + tests; no engine rewrite.
- Recommended phase: C6 (money helper with promotions) + per-phase tests

## Internationalization

### G-34 i18n readiness
- Area: Architecture prep
- Current state: hardcoded en-US strings/formats.
- Expected enterprise state: UI copy centralized (message catalog pattern) for EN with BN-ready structure; locale-aware date/currency formatting helpers; no full translation yet.
- Severity: LOW. Technical impact: incremental; apply to new/touched components.
- Recommended phase: C12 (helpers), ongoing convention

---

## Severity summary

| Severity | Gaps |
| --- | --- |
| CRITICAL | G-01 |
| HIGH | G-02, G-04, G-05, G-07, G-08, G-10, G-12, G-15, G-16, G-17, G-24, G-25, G-26, G-27, G-29, G-30, G-32 |
| MEDIUM | G-03, G-06, G-09, G-11, G-13, G-14, G-18, G-19, G-20, G-21, G-22, G-23, G-28, G-31, G-33 |
| LOW | G-34 |

## Database changes requiring approval (consolidated)

All additive; no existing columns/relations modified. Detailed migration plan in the roadmap.

1. `User.emailVerifiedAt`, `Customer.marketingConsentAt` (G-02)
2. `Promotion`, `PromotionRedemption` (G-16)
3. `SavedPassenger.isPreferred`, `SavedPassenger.frequentFlyerNumber` (G-19)
4. `Customer` address/photo fields (G-20)
5. `CustomerPreference` (G-21)
6. `InAppNotification` (G-24)
7. `SupportRequest` (+ optional `SupportMessage`) (G-25)
