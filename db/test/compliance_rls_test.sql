-- Cross-tenant tests for Always Compliance row-level security. Run against a disposable,
-- fully migrated database. Synthetic organisations only.
begin;

insert into organisation (id, kind, display_name, trust_level) values
  ('00000000-0000-0000-0000-0000000000ca', 'church', 'Church A', 'verified'),
  ('00000000-0000-0000-0000-0000000000cb', 'church', 'Church B', 'verified');
insert into compliance_register (version, content, status, approved_by) values ('test', '{}', 'draft', 'test');
insert into compliance_profile (org_id, profile) values ('00000000-0000-0000-0000-0000000000ca', '{"states":["NSW"]}');
insert into compliance_answer (org_id, evidence_id, answer) values ('00000000-0000-0000-0000-0000000000ca', 'pp-published', 'no');
insert into compliance_assessment (org_id, quarter, register_version, result) values ('00000000-0000-0000-0000-0000000000ca', '2026-Q4', 'test', '{}');
insert into compliance_change (source_id) values ('privacy-act');

set local role app_user;
select set_config('app.org_id', '00000000-0000-0000-0000-0000000000cb', true);

do $$ begin
  if (select count(*) from compliance_profile) <> 0 then raise exception 'FAIL: church B can see church A compliance profile'; end if;
  if (select count(*) from compliance_answer) <> 0 then raise exception 'FAIL: church B can see church A answers'; end if;
  if (select count(*) from compliance_assessment) <> 0 then raise exception 'FAIL: church B can see church A assessment'; end if;
  if (select count(*) from compliance_register) <> 1 then raise exception 'FAIL: the register should be readable by every member'; end if;
end $$;

-- Church B cannot write a profile for church A.
do $$ begin
  begin
    insert into compliance_profile (org_id, profile) values ('00000000-0000-0000-0000-0000000000ca', '{}');
    raise exception 'FAIL: church B wrote a profile for church A';
  exception when insufficient_privilege then null; end;
end $$;

-- The change queue and sources are for the foundation team (service role) only.
do $$ begin
  begin
    perform count(*) from compliance_change;
    raise exception 'FAIL: members can read the change queue';
  exception when insufficient_privilege then null; end;
end $$;

-- Church B cannot approve church A's assessment.
update compliance_assessment set approved_at = now() where org_id = '00000000-0000-0000-0000-0000000000ca';
reset role;
do $$ begin
  if (select approved_at from compliance_assessment where org_id = '00000000-0000-0000-0000-0000000000ca') is not null then raise exception 'FAIL: church B approved church A assessment'; end if;
end $$;

-- Church A sees its own.
set local role app_user;
select set_config('app.org_id', '00000000-0000-0000-0000-0000000000ca', true);
do $$ begin
  if (select count(*) from compliance_profile) <> 1 then raise exception 'FAIL: church A cannot see its own profile'; end if;
  if (select count(*) from compliance_answer) <> 1 then raise exception 'FAIL: church A cannot see its own answers'; end if;
end $$;

select 'compliance RLS tests passed' as result;
rollback;
