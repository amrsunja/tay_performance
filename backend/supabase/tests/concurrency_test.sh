#!/usr/bin/env bash
# Double-booking race: two connections book the same slot concurrently.
# Exactly ONE must win (bookings_no_overlap exclusion constraint).
# Usage: PGHOST=... PGPORT=... PGUSER=... PGDATABASE=... ./concurrency_test.sh
set -euo pipefail

V=$(psql -tA -c "select id from public.vehicle_variants limit 1")
D=$(psql -tA -c "select d::date from generate_series(current_date+14, current_date+27, interval '1 day') d where extract(isodow from d)=2 limit 1")
BEFORE=$(psql -tA -c "select count(*) from public.bookings where contact_name like 'Race %'")

run_one() {
  psql -tA <<EOF >/tmp/race_$1.out 2>&1 || true
select set_config('test.uid','00000000-0000-0000-0000-0000000000ad',false);
set role authenticated;
begin;
select public.admin_create_booking('$V'::uuid,'[{"zone_code":"rear_window","vlt_percent":35}]',
  ('$D'::date + time '11:00') at time zone 'Europe/Paris',
  'Race $1','060000000$1',null,null,1,null,null)->>'reference';
select pg_sleep(1);
commit;
EOF
}

run_one 1 & run_one 2 &
wait

AFTER=$(psql -tA -c "select count(*) from public.bookings where contact_name like 'Race %'")
WON=$((AFTER - BEFORE))
if [ "$WON" -eq 1 ]; then
  echo "OK — exactly one booking won the race"
else
  echo "FAIL — $WON bookings created for the same slot"
  exit 1
fi
