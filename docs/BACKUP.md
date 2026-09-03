# ONETRIPS PostgreSQL backup and restore

Automated backups are a production operations concern. They are **not** implemented inside the application worker.

PostgreSQL is the only primary relational database. Redis is not backed up by these scripts (cache/queue data only). Disaster recovery procedure: [DR.md](DR.md). Acceptance gate: [ACCEPTANCE.md](ACCEPTANCE.md).

## Backup frequency

Recommended: **daily at 02:00 UTC** via system cron (see `scripts/ops/cron.example`).

```cron
0 2 * * * cd /opt/onetrips && /usr/bin/node scripts/ops/backup-postgres.mjs >> /var/log/onetrips-backup.log 2>&1
```

Do not schedule backups from the Node notification worker.

## Retention

`BACKUP_RETENTION_DAYS` (default **14**). Old `onetrips-*.dump` files (and `.sha256` / `.manifest.json` sidecars) are deleted only after a successful dump.

## Storage location

`BACKUP_DIR` (default `./backups` in the repo). Production should set this to a dedicated volume, for example `/var/backups/onetrips`.

**Offsite copy is required for production.** Set `BACKUP_OFFSITE_REQUIRED=YES` and either:

| Variable | Destination |
| --- | --- |
| `BACKUP_OFFSITE_DIR` | Second disk, NFS, or object-store mount |
| `BACKUP_RCLONE_REMOTE` | `rclone` remote, e.g. `s3:onetrips-backups` |

Same-host copies prove the pipeline. They are **not** disaster recovery if the machine is lost.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection (credentials are never logged) |
| `BACKUP_DIR` | Directory for `onetrips-YYYY-MM-DD-HHMMSS.dump` |
| `BACKUP_RETENTION_DAYS` | Delete successful backups older than N days |
| `BACKUP_OFFSITE_DIR` | Offsite/second-location directory |
| `BACKUP_RCLONE_REMOTE` | Optional rclone destination (`remote:path`) |
| `BACKUP_OFFSITE_REQUIRED` | `YES` fails the backup if no offsite destination is configured |
| `RESTORE_DATABASE` | Must be `YES` to run a restore |
| `RESTORE_FILE` | Path to the `.dump` custom-format archive |
| `RESTORE_DB_NAME` | Optional target database name |
| `RESTORE_DRILL_DB` | Disposable drill database (default `onetrips_restore_drill`) |
| `POSTGRES_ADMIN_URL` | Optional superuser URL used only to CREATE/DROP drill databases |

## Backup format

`pg_dump --format=custom --compress=9` (schema + data). Each dump gets:

- `*.dump.sha256`
- `*.dump.manifest.json` (size, checksum, host, database — no passwords)

Verify with:

```bash
npm run backup:verify
```

Restore with `pg_restore --no-owner --no-acl`.

## Restore procedure

Restores are destructive. They never run without an explicit confirmation:

```bash
RESTORE_DATABASE=YES RESTORE_FILE=/var/backups/onetrips/onetrips-2026-08-20-020000.dump node scripts/ops/restore-postgres.mjs
```

Prefer restoring into a **new** database (`RESTORE_DB_NAME=onetrips_restored`) and switching application `DATABASE_URL` only after verification.

## Restore drill procedure

Uses a disposable database. It does not overwrite the live schema by default.

```bash
npm run backup:drill
```

The drill:

1. Creates a compressed custom-format backup and checksum sidecars
2. Lists the archive with `pg_restore --list`
3. Creates `onetrips_restore_drill`
4. Restores the dump
5. Opens Prisma against the drill database
6. Counts users, organizations, airports, airlines, bookings, payments, tickets, invoices, ledger, refunds, audit records
7. Confirms airport → city → country (and booking relations when present)
8. Drops the drill database unless `RESTORE_DRILL_KEEP=YES`

## Production acceptance

```bash
BACKUP_OFFSITE_DIR=/mnt/offsite/onetrips npm run accept
```

## MySQL → PostgreSQL data import

Existing MySQL rows (one-time cutover) are copied with:

```bash
MYSQL_DATABASE_URL=mysql://... DATABASE_URL=postgresql://... npm run db:migrate:mysql
```

This does not delete MySQL data. Redis is not imported.

This importer is a **legacy migration tool**. It is not executed by `npm run dev`, `npm run build`, `npm run start`, `npm run worker`, CI application startup, backup, or restore. See [scripts/ops/MYSQL-MIGRATION.md](../scripts/ops/MYSQL-MIGRATION.md).

Read-only validation after import:

```bash
npm run db:verify:mysql
```

## RPO / RTO assumptions

| Metric | Assumption |
| --- | --- |
| RPO | Up to 24 hours (daily backup). Any writes after the last dump are lost. |
| RTO | Hours, not minutes: provision PostgreSQL, restore the latest **offsite** dump, run Prisma migrate if needed, start apps. Size-dependent. |

These numbers are **not** a DR guarantee until the offsite destination is a different failure domain.

## Production safety precautions

- Never hard-code credentials. Use `DATABASE_URL`.
- Backup logs print host, database, file, size, checksum, and duration — never passwords.
- A failed dump exits non-zero and does **not** apply retention.
- Restore requires `RESTORE_DATABASE=YES`.
- Restore drills must use a disposable database name.
- Keep `FLIGHT_PROVIDER=mock` until a real GDS exists; backups do not replace provider data.
- Production cron must set `BACKUP_OFFSITE_REQUIRED=YES`.
