# ONETRIPS security notes (Phase 16)

This is a checklist of controls, not a pentest report. Do not treat it as a go-live certificate.

## Identity and access

- Session cookies are httpOnly (`ACCESS_COOKIE` / `REFRESH_COOKIE`). Tokens are not written to `localStorage`.
- Customer, B2B, and Admin JWTs carry `type`. Portal proxy redirects mismatched types.
- Booking, ticket, and invoice reads are scoped to the authenticated user (or B2B organization). Cross-account access is a 403 — see Playwright `e2e/b2c-authorization.spec.ts`.
- Admin and B2B almost all routes require a session. `GET /api/health` and auth routes are public by design.

## Secrets

- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be distinct, 32+ characters, and not example placeholders.
- `ENCRYPTION_KEY` must be 64 hex characters in production (passport fields).
- `PAYMENT_WEBHOOK_SECRET` must be 32+ characters in production.
- Production startup (`instrumentation.ts`) calls `assertProductionEnv()` unless `OT_ALLOW_DEV_SECRETS=1` (local `next start` only — never set in a real deploy).
- `FLIGHT_PROVIDER` and `HOTEL_PROVIDER` must remain `mock`. Real GDS / hotel API keys are out of scope.

## Rate limiting

Redis sliding window (`ot:rl:{bucket}`), in-memory fallback if Redis is down:

| Route | Limit |
| --- | --- |
| Search (flight/hotel) | 30 / minute / IP |
| Booking create | 10 / minute / IP |
| Payment initiate | 10 / minute / IP |
| Register | 8 / 15 minutes / IP in production (40 in development) |
| Login | 12 / 15 minutes / IP in production (60 in development) |
| OTP | 3 / 10 minutes / IP in production (20 in development) |
| Account mutations | 30 / minute / IP |
| Promo apply | 10 / minute / IP |

429 responses include `Retry-After`. Cookie-authenticated mutations and login/register/OTP also require a matching `Origin` when the header is present (`assertMutationOrigin`). Signed payment webhooks are exempt.

Production `/api/health` is `ok` only when PostgreSQL and Redis both respond, unless `OT_HEALTH_REQUIRE_REDIS` is unset **and** `NODE_ENV` is not production. Responses include `app` (`web` / `admin` / `b2b`) so a wrong process on port 3000 is obvious.

## HTTP headers

All three apps set `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and a per-request CSP nonce (Next.js `proxy.ts`). HSTS is added only when `NODE_ENV=production`.

## Logging and errors

- JSON logs via pino with redaction of passwords, tokens, OTP, passport, and card-like fields.
- Unhandled API errors return a generic 500 plus a `reference` id. Stacks are not sent to the browser.
- Optional Sentry: set `SENTRY_DSN`. No-op when unset.

## OWASP mapping (high level)

| Area | Control |
| --- | --- |
| A01 Broken access control | Session-scoped booking/ticket/invoice APIs; B2B `organizationId` from membership |
| A02 Cryptographic failures | httpOnly cookies; AES passports; HMAC webhooks |
| A03 Injection | Prisma parameterized queries; Zod on search/auth bodies |
| A04 Insecure design | Booking/payment state machines; mock providers only |
| A05 Security misconfiguration | Production env assert; CSP; security headers |
| A07 Auth failures | Login/OTP/register rate limits; lockout fields on `User` |
| A09 Logging failures | pino + optional Sentry; no secrets in logs |

## Out of scope

- Real GDS, hotel supplier, or payment gateway credentials
- WAF / CDN configuration
- Penetration test sign-off
- Automatic database failover (see [DR.md](DR.md))
