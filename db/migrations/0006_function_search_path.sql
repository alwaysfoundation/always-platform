-- 0006: pin the search path of the functions row-level security relies on, so a caller
-- can't shadow a table or function by putting another schema first.
alter function app_org() set search_path = public, pg_temp;
alter function app_user_id() set search_path = public, pg_temp;
alter function org_holds_response(uuid) set search_path = public, pg_temp;
alter function user_has_youth_access() set search_path = public, pg_temp;
