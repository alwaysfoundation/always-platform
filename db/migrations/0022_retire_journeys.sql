-- 0022: retire journeys across ministries (ADR 0013). Always does not link people across organisations.
-- Removes the linkage tables, guards and triggers created by 0021. The extra journey_milestone enum values
-- stay, because Postgres cannot drop enum values; nothing writes them. Consent records are left as given;
-- the API no longer accepts or acts on the share.journey purpose.
begin;

drop trigger if exists journey_unlink_on_withdraw on consent;
drop trigger if exists journey_cleanup on journey_response;
drop trigger if exists journey_response_guard on journey_response;
drop function if exists journey_unlink_on_withdraw();
drop function if exists journey_cleanup();
drop function if exists journey_response_guard();
drop table if exists journey_self_milestone;
drop table if exists journey_response;
drop table if exists journey;

commit;
