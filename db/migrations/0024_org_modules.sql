-- Modules an organisation has switched on from its Always account.
alter table organisation
  add column if not exists modules text[] not null default '{}'
  check (modules <@ array['respond', 'connect', 'safety', 'reports']::text[]);
