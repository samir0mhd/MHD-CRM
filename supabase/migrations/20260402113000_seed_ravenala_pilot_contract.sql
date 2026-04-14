insert into hotel_list (
  name,
  description,
  star_rating,
  region,
  room_types,
  meal_plans,
  highlights,
  supplier_group,
  booking_method,
  payment_terms,
  credit_agreement
)
select
  'The Ravenala Attitude',
  'Pilot hotel for the pricing engine module.',
  4,
  'North Mauritius',
  array['Couple Suite', 'Family Suite', 'Couple Junior Suite', 'Executive Seafront Adult Suite'],
  array['All Inclusive'],
  array['Pricing engine pilot', 'Attitude contract pilot'],
  'Attitude',
  'direct',
  'post-departure',
  false
where not exists (
  select 1 from hotel_list where lower(name) = 'the ravenala attitude'
);
with ravenala_hotel as (
  select id
  from hotel_list
  where lower(name) = 'the ravenala attitude'
  limit 1
)
insert into hotel_contracts (hotel_id, name, currency, market, supplier_reference, default_board_basis, status, notes)
select
  ravenala_hotel.id,
  'UK / Ireland 2025-2026',
  'GBP',
  'UK / IRELAND',
  'GBP THE RAVENALA ATTITUDE - 2025 2026.1.pdf',
  'All Inclusive',
  'active',
  'Seeded from Ravenala pilot contract for the hotel pricing engine.'
from ravenala_hotel
on conflict (hotel_id, name) do update
set
  currency = excluded.currency,
  market = excluded.market,
  supplier_reference = excluded.supplier_reference,
  default_board_basis = excluded.default_board_basis,
  status = excluded.status,
  notes = excluded.notes;
with ravenala_contract as (
  select hc.id
  from hotel_contracts hc
  join hotel_list hl on hl.id = hc.hotel_id
  where lower(hl.name) = 'the ravenala attitude'
    and hc.name = 'UK / Ireland 2025-2026'
  limit 1
)
insert into hotel_contract_versions (
  hotel_contract_id,
  version_name,
  valid_from,
  valid_to,
  booking_from,
  booking_to,
  issued_at,
  is_active,
  source_document_name,
  notes
)
select
  ravenala_contract.id,
  '2025-2026 v1',
  date '2025-11-01',
  date '2026-10-31',
  date '2025-03-31',
  date '2026-10-31',
  date '2025-03-04',
  true,
  'GBP THE RAVENALA ATTITUDE - 2025 2026.1.pdf',
  'Pilot Ravenala contract version.'
from ravenala_contract
on conflict (hotel_contract_id, version_name) do update
set
  valid_from = excluded.valid_from,
  valid_to = excluded.valid_to,
  booking_from = excluded.booking_from,
  booking_to = excluded.booking_to,
  issued_at = excluded.issued_at,
  is_active = excluded.is_active,
  source_document_name = excluded.source_document_name,
  notes = excluded.notes;
with ravenala_version as (
  select hcv.id
  from hotel_contract_versions hcv
  join hotel_contracts hc on hc.id = hcv.hotel_contract_id
  join hotel_list hl on hl.id = hc.hotel_id
  where lower(hl.name) = 'the ravenala attitude'
    and hcv.version_name = '2025-2026 v1'
  limit 1
),
seasons(season_code, season_name, travel_from, travel_to, sort_order) as (
  values
    ('HIGH_1_NOV', 'HIGH 1', date '2025-11-01', date '2025-11-30', 10),
    ('SHOULDER_1_DEC', 'SHOULDER 1', date '2025-12-01', date '2025-12-19', 20),
    ('PEAK_DEC_JAN', 'PEAK', date '2025-12-20', date '2026-01-04', 30),
    ('HIGH_2_JAN_APR', 'HIGH 2', date '2026-01-05', date '2026-04-30', 40),
    ('SHOULDER_2_MAY', 'SHOULDER 2', date '2026-05-01', date '2026-05-31', 50),
    ('SUPER_LOW_JUN', 'SUPER LOW', date '2026-06-01', date '2026-06-30', 60),
    ('LOW_JUL_AUG', 'LOW', date '2026-07-01', date '2026-08-31', 70),
    ('SHOULDER_2_SEP', 'SHOULDER 2', date '2026-09-01', date '2026-09-30', 80),
    ('HIGH_2_OCT', 'HIGH 2', date '2026-10-01', date '2026-10-31', 90)
)
insert into hotel_contract_seasons (contract_version_id, season_code, season_name, travel_from, travel_to, sort_order)
select ravenala_version.id, seasons.season_code, seasons.season_name, seasons.travel_from, seasons.travel_to, seasons.sort_order
from ravenala_version, seasons
on conflict (contract_version_id, season_code) do update
set
  season_name = excluded.season_name,
  travel_from = excluded.travel_from,
  travel_to = excluded.travel_to,
  sort_order = excluded.sort_order;
with ravenala_version as (
  select hcv.id
  from hotel_contract_versions hcv
  join hotel_contracts hc on hc.id = hcv.hotel_contract_id
  join hotel_list hl on hl.id = hc.hotel_id
  where lower(hl.name) = 'the ravenala attitude'
    and hcv.version_name = '2025-2026 v1'
  limit 1
),
rooms(room_name, room_code, room_group, max_adults, max_children, room_notes) as (
  values
    ('Couple Suite', 'CS', 'Suite', 2, 1, 'Standard couple room used in the Ravenala pilot rate grid.'),
    ('Family Suite', 'FS', 'Suite', 3, 2, 'Supports family occupancy. Minimum of 2 children/teens is required for children/teens in their own suite.'),
    ('Couple Junior Suite', 'CJS', 'Suite', 2, 0, 'Adult pricing only in the pilot rate grid.'),
    ('Executive Seafront Adult Suite', 'ESAS', 'Adult Suite', 2, 0, 'Adult-only suite in the pilot rate grid.')
)
insert into hotel_room_contracts (
  contract_version_id,
  room_name,
  room_code,
  room_group,
  min_pax,
  max_pax,
  max_adults,
  max_children,
  max_infants,
  room_notes
)
select
  ravenala_version.id,
  rooms.room_name,
  rooms.room_code,
  rooms.room_group,
  1,
  coalesce(rooms.max_adults, 2) + coalesce(rooms.max_children, 0),
  rooms.max_adults,
  rooms.max_children,
  1,
  rooms.room_notes
from ravenala_version, rooms
on conflict (contract_version_id, room_name) do update
set
  room_code = excluded.room_code,
  room_group = excluded.room_group,
  max_adults = excluded.max_adults,
  max_children = excluded.max_children,
  room_notes = excluded.room_notes;
with version_data as (
  select hcv.id as version_id
  from hotel_contract_versions hcv
  join hotel_contracts hc on hc.id = hcv.hotel_contract_id
  join hotel_list hl on hl.id = hc.hotel_id
  where lower(hl.name) = 'the ravenala attitude'
    and hcv.version_name = '2025-2026 v1'
  limit 1
),
rate_rows(season_code, room_name, double_rate, single_rate, triple_rate) as (
  values
    ('SHOULDER_1_DEC', 'Couple Suite', 147::numeric, 233::numeric, null::numeric),
    ('SHOULDER_1_DEC', 'Family Suite', 166::numeric, 266::numeric, 166::numeric),
    ('SHOULDER_1_DEC', 'Couple Junior Suite', 166::numeric, 266::numeric, null::numeric),
    ('SHOULDER_1_DEC', 'Executive Seafront Adult Suite', 193::numeric, 315::numeric, null::numeric),
    ('PEAK_DEC_JAN', 'Couple Suite', 228::numeric, 415::numeric, null::numeric),
    ('PEAK_DEC_JAN', 'Family Suite', 246::numeric, 452::numeric, 246::numeric),
    ('PEAK_DEC_JAN', 'Couple Junior Suite', 246::numeric, 452::numeric, null::numeric),
    ('PEAK_DEC_JAN', 'Executive Seafront Adult Suite', 273::numeric, 506::numeric, null::numeric),
    ('HIGH_2_JAN_APR', 'Couple Suite', 157::numeric, 250::numeric, null::numeric),
    ('HIGH_2_JAN_APR', 'Family Suite', 175::numeric, 283::numeric, 175::numeric),
    ('HIGH_2_JAN_APR', 'Couple Junior Suite', 175::numeric, 283::numeric, null::numeric),
    ('HIGH_2_JAN_APR', 'Executive Seafront Adult Suite', 202::numeric, 331::numeric, null::numeric),
    ('SHOULDER_2_MAY', 'Couple Suite', 142::numeric, 224::numeric, null::numeric),
    ('SHOULDER_2_MAY', 'Family Suite', 161::numeric, 257::numeric, 161::numeric),
    ('SHOULDER_2_MAY', 'Couple Junior Suite', 161::numeric, 257::numeric, null::numeric),
    ('SHOULDER_2_MAY', 'Executive Seafront Adult Suite', 188::numeric, 306::numeric, null::numeric),
    ('SUPER_LOW_JUN', 'Couple Suite', 127::numeric, 196::numeric, null::numeric),
    ('SUPER_LOW_JUN', 'Family Suite', 146::numeric, 230::numeric, 146::numeric),
    ('SUPER_LOW_JUN', 'Couple Junior Suite', 146::numeric, 230::numeric, null::numeric),
    ('SUPER_LOW_JUN', 'Executive Seafront Adult Suite', 173::numeric, 278::numeric, null::numeric),
    ('LOW_JUL_AUG', 'Couple Suite', 132::numeric, 206::numeric, null::numeric),
    ('LOW_JUL_AUG', 'Family Suite', 151::numeric, 239::numeric, 151::numeric),
    ('LOW_JUL_AUG', 'Couple Junior Suite', 151::numeric, 239::numeric, null::numeric),
    ('LOW_JUL_AUG', 'Executive Seafront Adult Suite', 178::numeric, 287::numeric, null::numeric),
    ('SHOULDER_2_SEP', 'Couple Suite', 142::numeric, 224::numeric, null::numeric),
    ('SHOULDER_2_SEP', 'Family Suite', 161::numeric, 257::numeric, 161::numeric),
    ('SHOULDER_2_SEP', 'Couple Junior Suite', 161::numeric, 257::numeric, null::numeric),
    ('SHOULDER_2_SEP', 'Executive Seafront Adult Suite', 188::numeric, 306::numeric, null::numeric),
    ('HIGH_2_OCT', 'Couple Suite', 157::numeric, 250::numeric, null::numeric),
    ('HIGH_2_OCT', 'Family Suite', 175::numeric, 283::numeric, 175::numeric),
    ('HIGH_2_OCT', 'Couple Junior Suite', 175::numeric, 283::numeric, null::numeric),
    ('HIGH_2_OCT', 'Executive Seafront Adult Suite', 202::numeric, 331::numeric, null::numeric)
)
insert into hotel_room_rates (
  room_contract_id,
  season_id,
  board_basis,
  pricing_model,
  rate_value,
  rate_unit,
  single_rate_value,
  triple_rate_value,
  currency,
  notes
)
select
  hrc.id,
  hcs.id,
  'All Inclusive',
  'per_person_per_night',
  rate_rows.double_rate,
  'pppn',
  rate_rows.single_rate,
  rate_rows.triple_rate,
  'GBP',
  'Seeded from Ravenala pilot contract.'
from version_data
join hotel_room_contracts hrc on hrc.contract_version_id = version_data.version_id
join hotel_contract_seasons hcs on hcs.contract_version_id = version_data.version_id
join rate_rows on rate_rows.room_name = hrc.room_name and rate_rows.season_code = hcs.season_code
on conflict (room_contract_id, season_id, board_basis) do update
set
  pricing_model = excluded.pricing_model,
  rate_value = excluded.rate_value,
  rate_unit = excluded.rate_unit,
  single_rate_value = excluded.single_rate_value,
  triple_rate_value = excluded.triple_rate_value,
  currency = excluded.currency,
  notes = excluded.notes;
with version_data as (
  select hcv.id as version_id
  from hotel_contract_versions hcv
  join hotel_contracts hc on hc.id = hcv.hotel_contract_id
  join hotel_list hl on hl.id = hc.hotel_id
  where lower(hl.name) = 'the ravenala attitude'
    and hcv.version_name = '2025-2026 v1'
  limit 1
),
occupancy_rows(season_code, room_name, age_band_code, rate_value) as (
  values
    ('SHOULDER_1_DEC', 'Couple Suite', 'child_share_3_12', 147::numeric),
    ('SHOULDER_1_DEC', 'Couple Suite', 'teen_share_13_17', 147::numeric),
    ('SHOULDER_1_DEC', 'Couple Suite', 'child_own_3_12', 100::numeric),
    ('SHOULDER_1_DEC', 'Couple Suite', 'teen_own_13_17', 110::numeric),
    ('SHOULDER_1_DEC', 'Family Suite', 'child_share_3_12', 54::numeric),
    ('SHOULDER_1_DEC', 'Family Suite', 'teen_share_13_17', 99::numeric),
    ('SHOULDER_1_DEC', 'Family Suite', 'child_own_3_12', 114::numeric),
    ('SHOULDER_1_DEC', 'Family Suite', 'teen_own_13_17', 124::numeric),
    ('PEAK_DEC_JAN', 'Couple Suite', 'child_share_3_12', 228::numeric),
    ('PEAK_DEC_JAN', 'Couple Suite', 'teen_share_13_17', 228::numeric),
    ('PEAK_DEC_JAN', 'Couple Suite', 'child_own_3_12', 160::numeric),
    ('PEAK_DEC_JAN', 'Couple Suite', 'teen_own_13_17', 170::numeric),
    ('PEAK_DEC_JAN', 'Family Suite', 'child_share_3_12', 71::numeric),
    ('PEAK_DEC_JAN', 'Family Suite', 'teen_share_13_17', 133::numeric),
    ('PEAK_DEC_JAN', 'Family Suite', 'child_own_3_12', 174::numeric),
    ('PEAK_DEC_JAN', 'Family Suite', 'teen_own_13_17', 184::numeric),
    ('HIGH_2_JAN_APR', 'Couple Suite', 'child_share_3_12', 157::numeric),
    ('HIGH_2_JAN_APR', 'Couple Suite', 'teen_share_13_17', 157::numeric),
    ('HIGH_2_JAN_APR', 'Couple Suite', 'child_own_3_12', 107::numeric),
    ('HIGH_2_JAN_APR', 'Couple Suite', 'teen_own_13_17', 117::numeric),
    ('HIGH_2_JAN_APR', 'Family Suite', 'child_share_3_12', 54::numeric),
    ('HIGH_2_JAN_APR', 'Family Suite', 'teen_share_13_17', 99::numeric),
    ('HIGH_2_JAN_APR', 'Family Suite', 'child_own_3_12', 121::numeric),
    ('HIGH_2_JAN_APR', 'Family Suite', 'teen_own_13_17', 131::numeric),
    ('SHOULDER_2_MAY', 'Couple Suite', 'child_share_3_12', 142::numeric),
    ('SHOULDER_2_MAY', 'Couple Suite', 'teen_share_13_17', 142::numeric),
    ('SHOULDER_2_MAY', 'Couple Suite', 'child_own_3_12', 96::numeric),
    ('SHOULDER_2_MAY', 'Couple Suite', 'teen_own_13_17', 106::numeric),
    ('SHOULDER_2_MAY', 'Family Suite', 'child_share_3_12', 54::numeric),
    ('SHOULDER_2_MAY', 'Family Suite', 'teen_share_13_17', 99::numeric),
    ('SHOULDER_2_MAY', 'Family Suite', 'child_own_3_12', 110::numeric),
    ('SHOULDER_2_MAY', 'Family Suite', 'teen_own_13_17', 120::numeric),
    ('SUPER_LOW_JUN', 'Couple Suite', 'child_share_3_12', 127::numeric),
    ('SUPER_LOW_JUN', 'Couple Suite', 'teen_share_13_17', 127::numeric),
    ('SUPER_LOW_JUN', 'Couple Suite', 'child_own_3_12', 85::numeric),
    ('SUPER_LOW_JUN', 'Couple Suite', 'teen_own_13_17', 95::numeric),
    ('SUPER_LOW_JUN', 'Family Suite', 'child_share_3_12', 54::numeric),
    ('SUPER_LOW_JUN', 'Family Suite', 'teen_share_13_17', 99::numeric),
    ('SUPER_LOW_JUN', 'Family Suite', 'child_own_3_12', 99::numeric),
    ('SUPER_LOW_JUN', 'Family Suite', 'teen_own_13_17', 108::numeric),
    ('LOW_JUL_AUG', 'Couple Suite', 'child_share_3_12', 132::numeric),
    ('LOW_JUL_AUG', 'Couple Suite', 'teen_share_13_17', 132::numeric),
    ('LOW_JUL_AUG', 'Couple Suite', 'child_own_3_12', 89::numeric),
    ('LOW_JUL_AUG', 'Couple Suite', 'teen_own_13_17', 98::numeric),
    ('LOW_JUL_AUG', 'Family Suite', 'child_share_3_12', 54::numeric),
    ('LOW_JUL_AUG', 'Family Suite', 'teen_share_13_17', 99::numeric),
    ('LOW_JUL_AUG', 'Family Suite', 'child_own_3_12', 102::numeric),
    ('LOW_JUL_AUG', 'Family Suite', 'teen_own_13_17', 112::numeric),
    ('SHOULDER_2_SEP', 'Couple Suite', 'child_share_3_12', 142::numeric),
    ('SHOULDER_2_SEP', 'Couple Suite', 'teen_share_13_17', 142::numeric),
    ('SHOULDER_2_SEP', 'Couple Suite', 'child_own_3_12', 96::numeric),
    ('SHOULDER_2_SEP', 'Couple Suite', 'teen_own_13_17', 106::numeric),
    ('SHOULDER_2_SEP', 'Family Suite', 'child_share_3_12', 54::numeric),
    ('SHOULDER_2_SEP', 'Family Suite', 'teen_share_13_17', 99::numeric),
    ('SHOULDER_2_SEP', 'Family Suite', 'child_own_3_12', 110::numeric),
    ('SHOULDER_2_SEP', 'Family Suite', 'teen_own_13_17', 120::numeric),
    ('HIGH_2_OCT', 'Couple Suite', 'child_share_3_12', 157::numeric),
    ('HIGH_2_OCT', 'Couple Suite', 'teen_share_13_17', 157::numeric),
    ('HIGH_2_OCT', 'Couple Suite', 'child_own_3_12', 107::numeric),
    ('HIGH_2_OCT', 'Couple Suite', 'teen_own_13_17', 117::numeric),
    ('HIGH_2_OCT', 'Family Suite', 'child_share_3_12', 54::numeric),
    ('HIGH_2_OCT', 'Family Suite', 'teen_share_13_17', 99::numeric),
    ('HIGH_2_OCT', 'Family Suite', 'child_own_3_12', 121::numeric),
    ('HIGH_2_OCT', 'Family Suite', 'teen_own_13_17', 131::numeric)
)
insert into hotel_room_occupancy_rates (
  room_rate_id,
  occupancy_code,
  adults,
  children,
  infants,
  age_band_code,
  rate_value,
  notes
)
select
  hrr.id,
  occupancy_rows.age_band_code,
  case when occupancy_rows.age_band_code like '%share%' then 2 else 0 end,
  1,
  0,
  occupancy_rows.age_band_code,
  occupancy_rows.rate_value,
  'Seeded Ravenala child/teen occupancy rate.'
from version_data
join hotel_contract_seasons hcs on hcs.contract_version_id = version_data.version_id
join hotel_room_contracts hrc on hrc.contract_version_id = version_data.version_id
join hotel_room_rates hrr on hrr.room_contract_id = hrc.id and hrr.season_id = hcs.id and hrr.board_basis = 'All Inclusive'
join occupancy_rows on occupancy_rows.season_code = hcs.season_code and occupancy_rows.room_name = hrc.room_name
where not exists (
  select 1
  from hotel_room_occupancy_rates existing
  where existing.room_rate_id = hrr.id
    and existing.age_band_code = occupancy_rows.age_band_code
);
with version_data as (
  select hcv.id as version_id
  from hotel_contract_versions hcv
  join hotel_contracts hc on hc.id = hcv.hotel_contract_id
  join hotel_list hl on hl.id = hc.hotel_id
  where lower(hl.name) = 'the ravenala attitude'
    and hcv.version_name = '2025-2026 v1'
  limit 1
)
insert into hotel_child_policies (
  contract_version_id,
  board_basis,
  child_band_name,
  age_from,
  age_to,
  pricing_method,
  value,
  applies_when_sharing_with,
  priority,
  notes
)
select
  version_data.version_id,
  'All Inclusive',
  'Infant FOC',
  0,
  2,
  'free',
  0,
  'parents',
  10,
  'Children under 3 years old are FOC on parents meal plan booked.'
from version_data
where not exists (
  select 1
  from hotel_child_policies hcp
  where hcp.contract_version_id = version_data.version_id
    and hcp.child_band_name = 'Infant FOC'
);
with version_data as (
  select hcv.id as version_id
  from hotel_contract_versions hcv
  join hotel_contracts hc on hc.id = hcv.hotel_contract_id
  join hotel_list hl on hl.id = hc.hotel_id
  where lower(hl.name) = 'the ravenala attitude'
    and hcv.version_name = '2025-2026 v1'
  limit 1
),
charges(charge_name, charge_code, value, stay_date_from, stay_date_to, age_from, age_to, notes) as (
  values
    ('Gala Dinner 24 December', 'GD24', 40::numeric, date '2025-12-24', date '2025-12-24', 13, 120, 'Compulsory prepayments to be done through the tour operator.'),
    ('Gala Dinner 24 December', 'GD24', 20::numeric, date '2025-12-24', date '2025-12-24', 7, 12, 'Compulsory prepayments to be done through the tour operator.'),
    ('Gala Dinner 24 December', 'GD24', 0::numeric, date '2025-12-24', date '2025-12-24', 0, 6, 'Compulsory prepayments to be done through the tour operator.'),
    ('Gala Dinner 31 December', 'GD31', 53::numeric, date '2025-12-31', date '2025-12-31', 13, 120, 'Compulsory prepayments to be done through the tour operator.'),
    ('Gala Dinner 31 December', 'GD31', 27::numeric, date '2025-12-31', date '2025-12-31', 7, 12, 'Compulsory prepayments to be done through the tour operator.'),
    ('Gala Dinner 31 December', 'GD31', 0::numeric, date '2025-12-31', date '2025-12-31', 0, 6, 'Compulsory prepayments to be done through the tour operator.')
)
insert into hotel_compulsory_charges (
  contract_version_id,
  charge_name,
  charge_code,
  pricing_method,
  value,
  per_person,
  per_night,
  stay_date_from,
  stay_date_to,
  age_from,
  age_to,
  notes
)
select
  version_data.version_id,
  charges.charge_name,
  charges.charge_code,
  'fixed_amount',
  charges.value,
  true,
  false,
  charges.stay_date_from,
  charges.stay_date_to,
  charges.age_from,
  charges.age_to,
  charges.notes
from version_data, charges
where not exists (
  select 1
  from hotel_compulsory_charges existing
  where existing.contract_version_id = version_data.version_id
    and existing.charge_name = charges.charge_name
    and coalesce(existing.age_from, -1) = coalesce(charges.age_from, -1)
    and coalesce(existing.age_to, -1) = coalesce(charges.age_to, -1)
);
with version_data as (
  select hcv.id as version_id
  from hotel_contract_versions hcv
  join hotel_contracts hc on hc.id = hcv.hotel_contract_id
  join hotel_list hl on hl.id = hc.hotel_id
  where lower(hl.name) = 'the ravenala attitude'
    and hcv.version_name = '2025-2026 v1'
  limit 1
)
insert into hotel_offers (
  contract_version_id,
  offer_code,
  offer_name,
  offer_family,
  status,
  booking_from,
  booking_to,
  travel_from,
  travel_to,
  minimum_nights,
  description,
  priority,
  stop_after_apply,
  notes
)
select
  version_data.version_id,
  'WBL2',
  'Winter Blues Campaign Extension',
  'percentage_discount',
  'active',
  date '2026-03-17',
  date '2026-04-16',
  date '2026-03-17',
  date '2027-01-31',
  5,
  '27% discount applicable to all rooms and pax sharing. Plus for families, 50% off kids aged 3-12 years old when sharing parents'' room.',
  10,
  false,
  'Combinable with Honeymoon, Civil Union and Wedding Anniversary Offer only. Not combinable with Discount Offer.'
from version_data
on conflict (contract_version_id, offer_code) do update
set
  offer_name = excluded.offer_name,
  offer_family = excluded.offer_family,
  status = excluded.status,
  booking_from = excluded.booking_from,
  booking_to = excluded.booking_to,
  travel_from = excluded.travel_from,
  travel_to = excluded.travel_to,
  minimum_nights = excluded.minimum_nights,
  description = excluded.description,
  priority = excluded.priority,
  stop_after_apply = excluded.stop_after_apply,
  notes = excluded.notes;
with offer_data as (
  select ho.id as offer_id
  from hotel_offers ho
  join hotel_contract_versions hcv on hcv.id = ho.contract_version_id
  join hotel_contracts hc on hc.id = hcv.hotel_contract_id
  join hotel_list hl on hl.id = hc.hotel_id
  where lower(hl.name) = 'the ravenala attitude'
    and hcv.version_name = '2025-2026 v1'
    and ho.offer_code = 'WBL2'
  limit 1
),
rules(rule_type, target_scope, pricing_method, value, age_from, age_to, room_name, board_basis, apply_stage, sort_order, notes) as (
  values
    ('child_discount', 'child', 'percentage', 50::numeric, 3, 12, null, 'All Inclusive', 'child_pricing', 10, 'Child pricing should be discounted first.'),
    ('percentage_discount', 'stay', 'percentage', 27::numeric, null, null, null, 'All Inclusive', 'offers', 20, 'Apply overall discount after child pricing.')
)
insert into hotel_offer_rules (
  hotel_offer_id,
  rule_type,
  target_scope,
  pricing_method,
  value,
  age_from,
  age_to,
  room_name,
  board_basis,
  apply_stage,
  sort_order,
  notes
)
select
  offer_data.offer_id,
  rules.rule_type,
  rules.target_scope,
  rules.pricing_method,
  rules.value,
  rules.age_from,
  rules.age_to,
  rules.room_name,
  rules.board_basis,
  rules.apply_stage,
  rules.sort_order,
  rules.notes
from offer_data, rules
where not exists (
  select 1
  from hotel_offer_rules existing
  where existing.hotel_offer_id = offer_data.offer_id
    and existing.rule_type = rules.rule_type
    and existing.apply_stage = rules.apply_stage
    and existing.sort_order = rules.sort_order
);
with offer_data as (
  select ho.id as offer_id
  from hotel_offers ho
  join hotel_contract_versions hcv on hcv.id = ho.contract_version_id
  join hotel_contracts hc on hc.id = hcv.hotel_contract_id
  join hotel_list hl on hl.id = hc.hotel_id
  where lower(hl.name) = 'the ravenala attitude'
    and hcv.version_name = '2025-2026 v1'
    and ho.offer_code = 'WBL2'
  limit 1
),
combos(with_offer_family, is_allowed, notes) as (
  values
    ('honeymoon', true, 'WBL2 can be combined with honeymoon-related benefits.'),
    ('anniversary', true, 'WBL2 can be combined with wedding anniversary benefits.'),
    ('fixed_discount', false, 'WBL2 is not combinable with Discount Offer.')
)
insert into hotel_offer_combinability (
  hotel_offer_id,
  with_offer_family,
  is_allowed,
  notes
)
select
  offer_data.offer_id,
  combos.with_offer_family,
  combos.is_allowed,
  combos.notes
from offer_data, combos
where not exists (
  select 1
  from hotel_offer_combinability existing
  where existing.hotel_offer_id = offer_data.offer_id
    and coalesce(existing.with_offer_family, '') = coalesce(combos.with_offer_family, '')
);
with hotel_data as (
  select hl.id as hotel_id, hcv.id as version_id
  from hotel_list hl
  join hotel_contracts hc on hc.hotel_id = hl.id
  join hotel_contract_versions hcv on hcv.hotel_contract_id = hc.id
  where lower(hl.name) = 'the ravenala attitude'
    and hcv.version_name = '2025-2026 v1'
  limit 1
),
tests(label, booking_date, check_in_date, check_out_date, room_name, board_basis, adults, child_ages, teen_ages, infants, expected_applied_offer_codes, expected_rejected_offer_codes, notes) as (
  values
    (
      'Ravenala base family suite without offer',
      date '2026-02-10',
      date '2026-02-20',
      date '2026-02-27',
      'Family Suite',
      'All Inclusive',
      2,
      array[8]::integer[],
      '{}'::integer[],
      0,
      '{}'::text[],
      array['WBL2']::text[],
      'Use this to verify base family suite pricing before promotional windows.'
    ),
    (
      'Ravenala WBL2 family suite child-first discount',
      date '2026-03-20',
      date '2026-03-25',
      date '2026-04-01',
      'Family Suite',
      'All Inclusive',
      2,
      array[8]::integer[],
      '{}'::integer[],
      0,
      array['WBL2']::text[],
      '{}'::text[],
      'Child pricing should be discounted first, then the overall 27% offer should apply.'
    ),
    (
      'Ravenala festive family suite with gala dinner',
      date '2025-10-10',
      date '2025-12-22',
      date '2025-12-29',
      'Family Suite',
      'All Inclusive',
      2,
      array[8]::integer[],
      '{}'::integer[],
      0,
      '{}'::text[],
      array['WBL2']::text[],
      'Use this to verify compulsory gala charges are added separately.'
    )
)
insert into hotel_pricing_test_cases (
  hotel_id,
  contract_version_id,
  label,
  booking_date,
  check_in_date,
  check_out_date,
  room_name,
  board_basis,
  adults,
  child_ages,
  teen_ages,
  infants,
  expected_applied_offer_codes,
  expected_rejected_offer_codes,
  notes
)
select
  hotel_data.hotel_id,
  hotel_data.version_id,
  tests.label,
  tests.booking_date,
  tests.check_in_date,
  tests.check_out_date,
  tests.room_name,
  tests.board_basis,
  tests.adults,
  tests.child_ages,
  tests.teen_ages,
  tests.infants,
  tests.expected_applied_offer_codes,
  tests.expected_rejected_offer_codes,
  tests.notes
from hotel_data, tests
where not exists (
  select 1
  from hotel_pricing_test_cases existing
  where existing.contract_version_id = hotel_data.version_id
    and existing.label = tests.label
);
