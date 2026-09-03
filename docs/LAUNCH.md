# ONETRIPS launch checklist (Phase 17)

The platform is **not launch-ready** until every production blocker below is closed. Mock GDS and mock hotel remain the only providers.

Disaster recovery: [DR.md](DR.md). Acceptance command: [ACCEPTANCE.md](ACCEPTANCE.md). Backups: [BACKUP.md](BACKUP.md).

## Must have (blockers)

- [ ] Distinct strong `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (32+ chars, not placeholders)
- [ ] `ENCRYPTION_KEY` = 64 hex characters
- [ ] Strong `PAYMENT_WEBHOOK_SECRET`
- [ ] Production `DATABASE_URL` (`postgresql://`) and `REDIS_URL`
- [ ] `FLIGHT_PROVIDER=mock` and `HOTEL_PROVIDER=mock` (do not point at a live supplier)
- [ ] **Offsite PostgreSQL backups in a different failure domain** — `BACKUP_OFFSITE_REQUIRED=YES` plus `BACKUP_OFFSITE_DIR` or `BACKUP_RCLONE_REMOTE`. Same-host `./backups` is not DR.
- [ ] `BACKUP_OFFSITE_DIR=/path npm run accept` green on the target environment
- [ ] TLS termination in front of the three apps (HSTS is emitted only in production)
- [ ] `OT_ALLOW_DEV_SECRETS` unset in the real environment

## Should have

- [ ] `SENTRY_DSN` and `SENTRY_ENVIRONMENT` (optional; errors still log via pino)
- [ ] `LOG_LEVEL=info` (or `warn`) in production
- [ ] Health checks scraped: `GET /api/health` on web `:3000`, admin `:3001`, B2B `:3002` (`ok` requires PostgreSQL; Redis is reported separately)
- [ ] GitHub Actions CI green (unit, integration, restore drill, acceptance, builds, Playwright)
- [ ] Weekly `npm run backup:drill` (see `scripts/ops/cron.example`)
- [ ] `npm run load:search` against a staging URL (mock search only)

## Verify before traffic

```bash
npm test
npm run test:integration
npm run build -w @onetrips/web
npm run build -w @onetrips/b2b
npm run build -w @onetrips/admin
npm run test:e2e
BACKUP_OFFSITE_DIR=/mnt/offsite/onetrips npm run accept
```

E2E covers the B2C flight journey, payment decline, IDOR, security headers, health, and hotel search smoke.

## Explicitly not ready

- Live airline GDS
- Live hotel API
- Live SSLCommerz / bKash (sandbox only)
- Public internet launch without offsite backups in a second failure domain and real secrets
- Automatic PostgreSQL failover / PITR
