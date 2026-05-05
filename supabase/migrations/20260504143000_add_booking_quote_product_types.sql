alter table deals
  add column if not exists booking_type text;

alter table quotes
  add column if not exists quote_mode text;

alter table bookings
  add column if not exists booking_type text;

update quotes
set quote_mode = case
  when quote_type = 'multi_centre' then 'multi_centre'
  else 'single'
end
where quote_mode is null;

update quotes
set quote_type = case
  when quote_type in ('single', 'multi_centre') then
    case
      when coalesce(nullif(trim(hotel), ''), '') = ''
        and (
          coalesce(jsonb_array_length(coalesce(flight_details->'outbound', '[]'::jsonb)), 0) > 0
          or coalesce(jsonb_array_length(coalesce(flight_details->'return', '[]'::jsonb)), 0) > 0
          or coalesce((cost_breakdown->>'flight_net')::numeric, 0) > 0
        ) then 'flight_only'
      when coalesce(nullif(trim(hotel), ''), '') <> ''
        and coalesce(jsonb_array_length(coalesce(flight_details->'outbound', '[]'::jsonb)), 0) = 0
        and coalesce(jsonb_array_length(coalesce(flight_details->'return', '[]'::jsonb)), 0) = 0
        and coalesce((cost_breakdown->>'flight_net')::numeric, 0) = 0
        and coalesce((cost_breakdown->>'trans_net')::numeric, 0) > 0 then 'accommodation_transfer'
      when coalesce(nullif(trim(hotel), ''), '') <> ''
        and coalesce(jsonb_array_length(coalesce(flight_details->'outbound', '[]'::jsonb)), 0) = 0
        and coalesce(jsonb_array_length(coalesce(flight_details->'return', '[]'::jsonb)), 0) = 0
        and coalesce((cost_breakdown->>'flight_net')::numeric, 0) = 0
        and coalesce((cost_breakdown->>'trans_net')::numeric, 0) = 0 then 'accommodation_only'
      else 'package'
    end
  else quote_type
end
where quote_type is not null;

update quotes
set quote_type = coalesce(quote_type, 'package');

with booking_component_counts as (
  select
    b.id as booking_id,
    exists(select 1 from booking_accommodations a where a.booking_id = b.id limit 1) as has_accommodation,
    exists(select 1 from booking_flights f where f.booking_id = b.id limit 1) as has_flights,
    exists(select 1 from booking_transfers t where t.booking_id = b.id limit 1) as has_transfers
  from bookings b
)
update bookings b
set booking_type = case
  when c.has_flights and not c.has_accommodation then 'flight_only'
  when not c.has_flights and c.has_accommodation and c.has_transfers then 'accommodation_transfer'
  when not c.has_flights and c.has_accommodation then 'accommodation_only'
  when c.has_flights and c.has_accommodation then 'package'
  else 'package'
end
from booking_component_counts c
where b.id = c.booking_id
  and b.booking_type is null;

update deals d
set booking_type = coalesce(
  (
    select b.booking_type
    from bookings b
    where b.deal_id = d.id
      and b.booking_type is not null
    order by b.created_at desc, b.id desc
    limit 1
  ),
  (
    select case
      when q.quote_type in ('package', 'accommodation_only', 'flight_only', 'accommodation_transfer', 'custom') then q.quote_type
      else 'package'
    end
    from quotes q
    where q.deal_id = d.id
    order by q.created_at desc, q.id desc
    limit 1
  ),
  'package'
)
where d.booking_type is null;

alter table deals
  alter column booking_type set default 'package';

alter table quotes
  alter column quote_mode set default 'single';

alter table quotes
  alter column quote_type set default 'package';

alter table bookings
  alter column booking_type set default 'package';

update deals
set booking_type = coalesce(booking_type, 'package');

update bookings
set booking_type = coalesce(booking_type, 'package');

alter table deals
  alter column booking_type set not null;

alter table quotes
  alter column quote_mode set not null;

alter table quotes
  alter column quote_type set not null;

alter table bookings
  alter column booking_type set not null;

alter table deals
  drop constraint if exists deals_booking_type_check;

alter table deals
  add constraint deals_booking_type_check
  check (booking_type in ('package', 'accommodation_only', 'flight_only', 'accommodation_transfer', 'custom'));

alter table quotes
  drop constraint if exists quotes_quote_mode_check;

alter table quotes
  add constraint quotes_quote_mode_check
  check (quote_mode in ('single', 'multi_centre'));

alter table quotes
  drop constraint if exists quotes_quote_type_check;

alter table quotes
  add constraint quotes_quote_type_check
  check (quote_type in ('package', 'accommodation_only', 'flight_only', 'accommodation_transfer', 'custom'));

alter table bookings
  drop constraint if exists bookings_booking_type_check;

alter table bookings
  add constraint bookings_booking_type_check
  check (booking_type in ('package', 'accommodation_only', 'flight_only', 'accommodation_transfer', 'custom'));
