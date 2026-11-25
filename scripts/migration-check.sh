#!/usr/bin/env bash
# Migrations are forward-only, so recovery is restore-from-backup. This checks the three things
# that must hold before a release: a fresh database migrates, an older seeded database upgrades
# with its data intact, and a backup of it restores to the same state. Synthetic data only.
set -euo pipefail
ADMIN=${TEST_ADMIN_DATABASE_URL:?set TEST_ADMIN_DATABASE_URL to a Postgres admin URL}
BASE=${ADMIN%/*}
UPGRADE_FROM=${UPGRADE_FROM:-0020}
export FIELD_KEY=${FIELD_KEY:-$(openssl rand -base64 32)}
work=$(mktemp -d)
trap 'rm -rf "$work"; for d in mc_fresh mc_upgrade mc_restore; do psql -q "$ADMIN" -c "drop database if exists $d" >/dev/null 2>&1 || true; done' EXIT

for d in mc_fresh mc_upgrade mc_restore; do psql -q "$ADMIN" -c "drop database if exists $d" -c "create database $d"; done

rls() { for f in db/test/rls_test.sql db/test/compliance_rls_test.sql; do psql -q -v ON_ERROR_STOP=1 "$1" -f "$f" >/dev/null; done; }
count() { psql -tA "$1" -c "select (select count(*) from organisation) || '/' || (select count(*) from schema_migration)"; }

echo "Fresh database"
DATABASE_URL=$BASE/mc_fresh npx tsx scripts/migrate.ts >/dev/null
rls "$BASE/mc_fresh"

echo "Upgrade a seeded database from migration $UPGRADE_FROM"
mkdir "$work/old"
for f in db/migrations/*.sql; do [[ $(basename "$f") < "${UPGRADE_FROM}_~" ]] && cp "$f" "$work/old/"; done
DATABASE_URL=$BASE/mc_upgrade npx tsx scripts/migrate-dir.ts "$work/old" >/dev/null
DATABASE_URL=$BASE/mc_upgrade npx tsx scripts/seed-dev.ts >/dev/null
before=$(psql -tA "$BASE/mc_upgrade" -c "select count(*) from organisation")
DATABASE_URL=$BASE/mc_upgrade npx tsx scripts/migrate.ts >/dev/null
after=$(psql -tA "$BASE/mc_upgrade" -c "select count(*) from organisation")
[[ "$before" == "$after" && "$after" -gt 0 ]] || { echo "Organisations changed in upgrade: $before -> $after"; exit 1; }
[[ $(count "$BASE/mc_upgrade") == "$after/$(count "$BASE/mc_fresh" | cut -d/ -f2)" ]] || { echo "Upgraded database is missing migrations"; exit 1; }
rls "$BASE/mc_upgrade"

echo "Back up and restore"
# Plain SQL so a newer pg_dump restores into an older server (it may emit settings the server lacks).
pg_dump --no-owner "$BASE/mc_upgrade" | grep -v '^SET transaction_timeout' > "$work/backup.sql"
psql -q -v ON_ERROR_STOP=1 "$BASE/mc_restore" -f "$work/backup.sql" >/dev/null
[[ $(count "$BASE/mc_restore") == $(count "$BASE/mc_upgrade") ]] || { echo "Restore does not match the backup"; exit 1; }
rls "$BASE/mc_restore"

echo "Migrations, upgrade and restore: OK"
