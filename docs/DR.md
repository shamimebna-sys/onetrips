# ONETRIPS disaster recovery (Phase 17)

This is the operational recovery procedure for the PostgreSQL source of truth. It is **not** a high-availability cluster and it does **not** restore Redis.

Redis holds search caches, notification queues, and rate-limit counters. **Never restore Redis as financial state.** Wallet, ledger, bookings, payments, tickets, invoices, and refunds live only in PostgreSQL.

## What this DR plan covers

| Event | Recovery |
| --- | --- |
| Accidental SQL / bad deploy | Restore the latest verified dump into a **new** database, check counts, switch `DATABASE_URL` |
| Disk failure on the app host | Provision PostgreSQL, restore the **offsite** dump, migrate, start apps |
| Region / machine loss | Same, using the offsite copy in a different failure domain |
| Redis loss | Start empty Redis. Search sessions expire; money records are in PostgreSQL |

## RPO / RTO

| Metric | Current assumption |
| --- | --- |
| RPO | Up to 24 hours with daily 02:00 UTC backups. Any writes after the last successful dump are lost. |
| RTO | Hours: provision PostgreSQL, restore, `prisma migrate deploy`, start Redis, start the three apps and the notification worker. Size-dependent. |

These numbers are **not** a contractual SLA. They describe dump-based recovery until streaming replication exists.

## Backup chain

1. `pg_dump --format=custom --compress=9` → `BACKUP_DIR`
2. SHA-256 sidecar + JSON manifest (host, database, bytes — never passwords)
3. `pg_restore --list` verification
4. Offsite copy to `BACKUP_OFFSITE_DIR` and/or `BACKUP_RCLONE_REMOTE`
5. Retention (`BACKUP_RETENTION_DAYS`, default 14) on local and directory offsite copies

Production cron **must** set `BACKUP_OFFSITE_REQUIRED=YES`.

## Offsite destination

Use a **different failure domain** than the live database disk:

- Second disk, NFS, or object-store mount → `BACKUP_OFFSITE_DIR`
- `rclone` remote (S3, B2, GCS, SFTP) → `BACKUP_RCLONE_REMOTE=remote:bucket/onetrips`

Same-host `./backups/offsite` is valid only to prove the pipeline. It is **not** disaster recovery.

## Restore (production incident)

1. Stop writers (apps + worker) if the live database is still reachable.
2. Copy the chosen dump (and `.sha256`) from offsite to the recovery host.
3. Verify: `RESTORE_FILE=/path/to/file.dump npm run backup:verify`
4. Restore into a **new** database:

```bash
RESTORE_DATABASE=YES RESTORE_DB_NAME=onetrips_restored RESTORE_FILE=/path/to/file.dump npm run backup:restore
```

5. Point a throwaway Prisma check at the restored database (or run `npm run backup:drill` against a disposable name).
6. Confirm users, organizations, airports, airlines, bookings, payments, tickets, invoices, ledger, refunds, audit.
7. `npm run db:migrate:deploy` against the restored URL if the dump is older than HEAD.
8. Switch application `DATABASE_URL`, start Redis empty, start web / admin / B2B / worker.
9. Hit `GET /api/health` on all three apps. `ok` requires PostgreSQL.

Never restore onto the live database name without `RESTORE_DATABASE=YES` and an explicit decision. Prefer rename/switch.

## Restore drill (no incident)

Weekly, against a disposable database:

```bash
npm run backup:drill
```

CI also runs this. Keep `RESTORE_DRILL_DB` different from production.

## Redis and application files

- Do not treat Redis AOF/RDB as a money backup.
- Application code and `.env` secrets are recovered from git + the secret store, not from `pg_dump`.
- Mock GDS/hotel payloads are not in the dump; keep `FLIGHT_PROVIDER=mock` and `HOTEL_PROVIDER=mock`.

## What this phase does not provide

- Multi-AZ PostgreSQL replication
- Automatic failover
- Point-in-time recovery (WAL archiving)
- Offsite storage itself (you must attach a real remote or second disk)
