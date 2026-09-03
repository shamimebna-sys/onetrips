# Archived MySQL backup scripts

These scripts dumped and restored MySQL with `mysqldump`. They are **not** the production backup path.

Use `scripts/ops/backup-postgres.mjs` and `scripts/ops/restore-postgres.mjs` instead.

The MySQL instance must remain untouched until PostgreSQL import, validation, and restore drill succeed.
