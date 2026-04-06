-- Link the Supabase auth user to the staff_users record.
-- Without this, getAccessContext() cannot match the authenticated session
-- to a staff record, causing the access route to return 401 for all requests,
-- leaving staffUsers=[] on every page and showing every booking as "Unassigned".
update staff_users
set auth_user_id = 'f3402275-0936-4048-a8ad-79820117d3ad'
where id = 1
  and auth_user_id is null;
