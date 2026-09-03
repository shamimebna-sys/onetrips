# ONETRIPS production acceptance (Phase 17)

Executable gate for production-shaped environments. This is **not** permission to take live airline, hotel, or payment traffic.

```bash
BACKUP_OFFSITE_DIR=/mnt/offsite/onetrips npm run accept
```

The command fails unless:

1. `DATABASE_URL` is `postgresql://`
2. `FLIGHT_PROVIDER` and `HOTEL_PROVIDER` are `mock`
3. Catalog relationships exist (airport → city → country)
4. A PostgreSQL dump is created with SHA-256 + manifest
5. `pg_restore --list` accepts the dump
6. An offsite destination is configured (`BACKUP_OFFSITE_DIR` or `BACKUP_RCLONE_REMOTE`) and the copy succeeds
7. A restore drill succeeds (skip only with `ACCEPTANCE_SKIP_DRILL=YES` after a drill in the same job)

## Still required before public launch

See [LAUNCH.md](LAUNCH.md):

- Real JWT / encryption / webhook secrets (not placeholders)
- TLS in front of the three apps
- `OT_ALLOW_DEV_SECRETS` unset
- Offsite destination in a **different failure domain** (not `./backups` on the same disk)
- Health checks scraped

## Explicitly out of scope

- Live GDS, hotel API, SSLCommerz / bKash
- PostgreSQL streaming replication / automatic failover
