-- 0007: pin the search path of the reporting functions (flagged by the Supabase security advisor).
alter function au_region(text) set search_path = public, pg_temp;
alter function tally_response() set search_path = public, pg_temp;
alter function tally_offer() set search_path = public, pg_temp;
alter function tally_handoff() set search_path = public, pg_temp;
