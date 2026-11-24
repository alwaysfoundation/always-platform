-- Always AI joins the tools an organisation can switch on. It runs on each person's own device,
-- so switching it on stores nothing about what anyone asks (ADR 0020, ADR 0021).
alter table organisation drop constraint if exists organisation_modules_check;
alter table organisation add constraint organisation_modules_check
  check (modules <@ array['respond', 'connect', 'safety', 'reports', 'ai']::text[]);
