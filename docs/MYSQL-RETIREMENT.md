# MySQL retirement plan

PostgreSQL is the application source of truth. The legacy MySQL `flight_app` database is retained until this checklist is green.

**Do not drop or delete MySQL automatically.** An operator must run any retirement commands after `MYSQL_RETIREMENT_READY=YES`.

## Status (2026-08-20)

```
MYSQL_RETIREMENT_READY=YES
```

All MySQL source rows are present in PostgreSQL with matching IDs, booking/payment/ticket/invoice references, and ledger amounts (string/Decimal comparison). PostgreSQL may have *additional* rows created after cutover (E2E, wallet concurrency, webhook/refund tests). That is expected and is not data loss.

MySQL `flight_app` was **not** deleted.

## Ready gate

`MYSQL_RETIREMENT_READY` is `YES` only when all of the following are true:

1. PostgreSQL data validated against MySQL (`npm run db:verify:mysql`)
2. PostgreSQL backup verified (`npm run backup` + `npm run backup:verify`)
3. PostgreSQL restore drill verified (`npm run backup:drill`)
4. web, admin, b2b, and worker run on PostgreSQL
5. CI starts PostgreSQL (not MySQL)
6. Playwright E2E uses `DATABASE_URL=postgresql://...`
7. No runtime MySQL dependency under `apps/` or `packages/`
8. Production startup rejects `mysql://` and `mysql2://` (`PostgreSQL is required for production.`)
9. Empty PostgreSQL bootstrap works (`npm run db:bootstrap:empty`)
10. This report is complete

## Safe retirement procedure (manual)

1. Freeze writes on MySQL (read-only) if it is still reachable.
2. Take a final MySQL dump with the archived scripts in `scripts/ops/legacy-mysql/` for rollback reference only.
3. Take a PostgreSQL `pg_dump` and copy it offsite.
4. Confirm application `DATABASE_URL` is `postgresql://` in every process.
5. Stop any leftover MySQL clients (none should exist in the apps).
6. Keep MySQL offline but unrestored for a defined rollback window.
7. Only then drop `flight_app` / stop the MySQL instance.

## Rollback

Restore the last verified PostgreSQL dump. Do not fail over to MySQL. There is no dual-write and no MySQL read fallback.
