-- Always AI is no longer offered as a module (ADR 0022).
update organisation set modules = array_remove(modules, 'ai') where 'ai' = any(modules);
alter table organisation drop constraint if exists organisation_modules_check;
alter table organisation
  add constraint organisation_modules_check
  check (modules <@ array['respond', 'connect', 'safety', 'reports']::text[]);
