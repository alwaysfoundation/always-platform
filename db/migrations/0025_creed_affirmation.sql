-- When the organisation's admin affirmed the Nicene Creed (AD 381) on creating its Always account.
alter table organisation add column if not exists creed_affirmed_at timestamptz;
