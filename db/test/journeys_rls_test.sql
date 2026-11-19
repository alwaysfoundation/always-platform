-- Journeys: no ministry can read journeys directly; minors and missing consent are refused by the database itself.
-- Run after all migrations against a disposable database. Synthetic data only.
begin;

insert into organisation (id, kind, display_name, trust_level) values
  ('00000000-0000-0000-0000-0000000000ea', 'church', 'Church A', 'verified');
insert into response (id, first_name_ct, age_band, step, delete_after) values
  ('00000000-0000-0000-0000-0000000000e1', '\xdead', '18+', 'church', now() + interval '30 days'),
  ('00000000-0000-0000-0000-0000000000e2', '\xbeef', '15-17', 'youth', now() + interval '14 days'),
  ('00000000-0000-0000-0000-0000000000e3', '\xcafe', '18+', 'church', now() + interval '30 days');
insert into consent (response_id, purposes, recipients, allow_next_nearby, wording_version, party, age_band, collected_at) values
  ('00000000-0000-0000-0000-0000000000e1', '{connect.church,share.journey}', '{}', true, 'v1', 'self', '18+', now()),
  ('00000000-0000-0000-0000-0000000000e2', '{connect.church,share.journey}', '{}', true, 'v1', 'self', '15-17', now()),
  ('00000000-0000-0000-0000-0000000000e3', '{connect.church}', '{}', true, 'v1', 'self', '18+', now());
insert into journey (id, link_hash) values ('00000000-0000-0000-0000-0000000000f1', '\x01');
insert into journey_response (response_id, journey_id) values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1');

do $$ begin
  begin
    insert into journey_response (response_id, journey_id) values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000f1');
    raise exception 'FAIL: a minor was linked';
  exception when others then if sqlerrm not like '%journey_minors_never_linked%' then raise; end if; end;
  begin
    insert into journey_response (response_id, journey_id) values ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000f1');
    raise exception 'FAIL: linked without share.journey consent';
  exception when others then if sqlerrm not like '%journey_consent_required%' then raise; end if; end;
end $$;

set local role app_user;
select set_config('app.org_id', '00000000-0000-0000-0000-0000000000ea', true);
do $$ begin
  begin perform 1 from journey; raise exception 'FAIL: app_user can read journey';
  exception when insufficient_privilege then null; end;
  begin perform 1 from journey_response; raise exception 'FAIL: app_user can read journey_response';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Withdrawal unlinks, and an empty journey is removed.
update consent set withdrawn_at = now() where response_id = '00000000-0000-0000-0000-0000000000e1';
do $$ begin
  if exists (select 1 from journey_response) then raise exception 'FAIL: withdrawal did not unlink'; end if;
  if exists (select 1 from journey) then raise exception 'FAIL: empty journey not removed'; end if;
end $$;

rollback;
