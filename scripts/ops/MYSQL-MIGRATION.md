# LEGACY MIGRATION TOOL

`scripts/ops/migrate-mysql-to-postgres.mjs` copies rows from the retired MySQL `flight_app` database into PostgreSQL.

`mysql2` is required only for this one-time MySQL → PostgreSQL migration. It is a root `devDependency` and is **never** imported by:

- `apps/web`
- `apps/admin`
- `apps/b2b`
- `packages/` (application code)
- the notification worker
- CI production startup
- `npm run backup` / `backup:verify` / `backup:drill`
- `npm run restore`

## Do not run this during application lifecycle

This script is **not** executed by:

```bash
npm run dev
npm run build
npm run start
npm run worker
```

Invoke only when an operator is performing the one-time import:

```bash
npm run db:migrate:mysql
```

Requires `MYSQL_DATABASE_URL=mysql://...` (source) and `DATABASE_URL=postgresql://...` (destination).

It does not delete MySQL. Redis is not imported.

## Related

- Read-only comparison after import: `npm run db:verify:mysql`
- Archived MySQL dump scripts: `scripts/ops/legacy-mysql/`
- Archived MySQL Prisma SQL: `packages/database/prisma/migrations-mysql-archive/`
