#!/usr/bin/env bash
# Validate the migration set + business logic on a BARE Postgres (no Supabase needed).
# Usage: ./run_local_harness.sh  [database_url]
# With no argument it creates/drops a scratch db `tay_test` on localhost.
set -euo pipefail
cd "$(dirname "$0")"

DB_URL="${1:-}"
if [ -z "$DB_URL" ]; then
  dropdb --if-exists tay_test
  createdb tay_test
  DB_URL="postgresql:///tay_test"
fi

psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
-- emulate Supabase default privileges before running migrations
\i harness_stub.sql
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
SQL

for f in ../migrations/*.sql; do
  echo "== applying $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done

echo "== running business tests"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f business_tests.sql
