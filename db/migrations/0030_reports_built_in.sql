-- Reports is part of every account, not a switchable module (ADR 0023).
update organisation set modules = array_remove(modules, 'reports') where 'reports' = any(modules);
alter table organisation drop constraint if exists organisation_modules_check;
alter table organisation
  add constraint organisation_modules_check
  check (modules <@ array['respond', 'connect', 'safety']::text[]);
