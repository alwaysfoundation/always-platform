-- Always AI is a module of the Always account (ADR 0021).
-- It stores nothing about what anyone writes: only that an organisation has switched it on.
alter table organisation drop constraint if exists organisation_modules_check;
alter table organisation
  add constraint organisation_modules_check
  check (modules <@ array['respond', 'connect', 'safety', 'reports', 'ai']::text[]);
