# ONETRIPS Architecture

Modular monolith in a Turborepo. Three Next.js apps share domain packages and one Prisma/PostgreSQL database. Redis is used for cache, queues, and rate limits only.

```text
apps/
  web/      customer website (port 3000)
  admin/    operations console (port 3001)
  b2b/      agency portal (port 3002)
packages/
  ui/             design system
  database/       Prisma schema + client
  shared/         states, permissions, errors, money
  auth/           JWT + permission checks
  catalog/        airports, airlines, countries, suppliers
  customer/       customer profile + saved travelers
  booking/        booking domain (state machine)
  flight-search/  FlightProviderPort, mock adapter, timeouts, circuit, operations
  hotel-search/   HotelProviderPort, mock adapter, room search sessions
  payments/       payment provider port
  ticketing/      e-ticket issue + PDF
  organization/   B2B agency, members, branches
  finance/        wallet, ledger, credit, invoices
  pricing/        fare markup, service fees, quote engine
  ops/            admin dashboard, reports, audit, settings
  notifications/  email/SMS ports, Redis queue, worker
  refunds/        cancel, void tickets, refund, reconciliation
  observability/  rate limit, pino, Sentry, health, security headers, production env
```

## Rules

1. Business logic lives in packages, never in React components.
2. External APIs sit behind ports/adapters.
3. Booking and payment status use explicit state machines.
4. Financial events are append-only ledger entries.
5. Secrets never ship to the browser.
6. The home page in `apps/web/app/page.tsx` is the visual source of truth.

## Local development

```bash
docker compose up -d
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Admin: http://localhost:3001  
B2B: http://localhost:3002

PostgreSQL is the financial source of truth. Backup, restore drill, and disaster recovery: [BACKUP.md](BACKUP.md), [DR.md](DR.md), [ACCEPTANCE.md](ACCEPTANCE.md). MySQL is a retired legacy database: [MYSQL-RETIREMENT.md](MYSQL-RETIREMENT.md).
