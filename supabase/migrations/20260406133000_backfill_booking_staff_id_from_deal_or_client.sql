do $$
declare
  updated_rule_1 integer := 0;
  updated_rule_2 integer := 0;
  unresolved integer := 0;
begin
  with updated as (
    update bookings
    set staff_id = deals.staff_id
    from deals
    where bookings.deal_id = deals.id
      and bookings.staff_id is null
      and deals.staff_id is not null
    returning bookings.id
  )
  select count(*) into updated_rule_1 from updated;

  with updated as (
    update bookings
    set staff_id = clients.owner_staff_id
    from deals
    join clients on clients.id = deals.client_id
    where bookings.deal_id = deals.id
      and bookings.staff_id is null
      and deals.staff_id is null
      and clients.owner_staff_id is not null
    returning bookings.id
  )
  select count(*) into updated_rule_2 from updated;

  select count(*)
  into unresolved
  from bookings
  join deals on deals.id = bookings.deal_id
  left join clients on clients.id = deals.client_id
  where bookings.staff_id is null
    and deals.staff_id is null
    and clients.owner_staff_id is null;

  raise notice 'Booking owner backfill complete. Rule 1 updated: %, Rule 2 updated: %, Unresolved: %',
    updated_rule_1,
    updated_rule_2,
    unresolved;
end $$;
