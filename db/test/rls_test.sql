-- Cross-tenant tests for row-level security. Run against a disposable database:
--   psql -v ON_ERROR_STOP=1 -f db/migrations/0001_core.sql -f db/test/rls_test.sql
-- Synthetic data only.
begin;

insert into organisation (id, kind, display_name, trust_level) values
  ('00000000-0000-0000-0000-00000000000a', 'church', 'Church A', 'verified'),
  ('00000000-0000-0000-0000-00000000000b', 'church', 'Church B', 'verified');

insert into app_user_account (id, email_ct, email_hash, display_name) values
  ('00000000-0000-0000-0000-0000000000a1', '\x00', '\x01', 'A follow-up'),
  ('00000000-0000-0000-0000-0000000000b1', '\x00', '\x02', 'B follow-up');
insert into membership values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'follow_up', false),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', 'follow_up', false);

insert into response (id, first_name_ct, age_band, step, delete_after) values
  ('00000000-0000-0000-0000-0000000000c1', '\xdead', '18+', 'church', now() + interval '30 days'),
  ('00000000-0000-0000-0000-0000000000c2', '\xbeef', '15-17', 'youth', now() + interval '14 days');
insert into handoff (id, response_id, state, age_band) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'offered', '18+'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2', 'offered', '15-17');
insert into handoff_offer (handoff_id, seq, org_id, offered_at, deadline) values
  ('00000000-0000-0000-0000-0000000000d1', 1, '00000000-0000-0000-0000-00000000000a', now(), now() + interval '2 hours'),
  ('00000000-0000-0000-0000-0000000000d2', 1, '00000000-0000-0000-0000-00000000000a', now(), now() + interval '2 hours');

set local role app_user;

-- Church B sees nothing of Church A's people.
select set_config('app.org_id', '00000000-0000-0000-0000-00000000000b', true);
select set_config('app.user_id', '00000000-0000-0000-0000-0000000000b1', true);
do $$ begin
  if (select count(*) from response) <> 0 then raise exception 'FAIL: church B can see church A responses'; end if;
end $$;

-- Church A follow-up (no youth access) sees the adult but not the minor.
select set_config('app.org_id', '00000000-0000-0000-0000-00000000000a', true);
select set_config('app.user_id', '00000000-0000-0000-0000-0000000000a1', true);
do $$ begin
  if (select count(*) from response) <> 1 then raise exception 'FAIL: expected exactly the adult response for church A'; end if;
  if exists (select 1 from response where age_band <> '18+') then raise exception 'FAIL: minor visible without youth access'; end if;
end $$;

reset role;
-- Under-13 child data is refused by the schema.
do $$ begin
  begin
    insert into response (first_name_ct, age_band, step, delete_after) values ('\x00', 'under13', 'youth', now());
    raise exception 'FAIL: under-13 child name accepted';
  exception when check_violation then null;
  end;
end $$;

-- Only one pending offer per handoff.
do $$ begin
  begin
    insert into handoff_offer (handoff_id, seq, org_id, offered_at, deadline) values
      ('00000000-0000-0000-0000-0000000000d1', 2, '00000000-0000-0000-0000-00000000000b', now(), now() + interval '2 hours');
    raise exception 'FAIL: second pending offer accepted';
  exception when unique_violation then null;
  end;
end $$;

select 'ALL RLS TESTS PASSED' as result;
rollback;
