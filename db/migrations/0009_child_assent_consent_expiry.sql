-- 0009: child assent for under-15s, and consent that lapses after 12 months.
-- Children and Young People's Information Policy: a parent's consent is not enough on its own;
-- the child agrees too. Privacy Policy: consent lasts 12 months unless the person renews it.

alter table consent add column child_assent_at timestamptz;
alter table consent add column expires_at timestamptz;

update consent set expires_at = collected_at + interval '12 months' where expires_at is null;
update consent set child_assent_at = collected_at
  where child_assent_at is null and age_band = '13-14' and party = 'self';

alter table consent alter column expires_at set not null;
alter table consent alter column expires_at set default (now() + interval '12 months');

-- Under-15s: the child's assent must be recorded. NOT VALID keeps any older rows readable
-- (the API refuses them anyway) while every new or updated row is checked.
alter table consent add constraint under15_child_assent
  check (age_band not in ('under13', '13-14') or child_assent_at is not null) not valid;

create index consent_expires_at_idx on consent (expires_at) where withdrawn_at is null;

-- True while a consent can still be used: not withdrawn and not lapsed.
create or replace function consent_is_current(c consent) returns boolean
  language sql stable set search_path = public, pg_temp
  as $$ select c.withdrawn_at is null and c.expires_at > now() $$;
