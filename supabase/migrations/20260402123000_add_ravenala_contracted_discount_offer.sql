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
  travel_from,
  travel_to,
  description,
  priority,
  stop_after_apply,
  notes
)
select
  version_data.version_id,
  'CONTRACT10',
  'Contracted Discount 10%',
  'percentage_discount',
  'active',
  date '2025-11-01',
  date '2026-10-31',
  'Baseline contracted discount seeded from manual Ravenala validation.',
  90,
  false,
  'Applies when no higher-priority non-combinable campaign offer overrides it.'
from version_data
on conflict (contract_version_id, offer_code) do update
set
  offer_name = excluded.offer_name,
  offer_family = excluded.offer_family,
  status = excluded.status,
  travel_from = excluded.travel_from,
  travel_to = excluded.travel_to,
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
    and ho.offer_code = 'CONTRACT10'
  limit 1
)
insert into hotel_offer_rules (
  hotel_offer_id,
  rule_type,
  target_scope,
  pricing_method,
  value,
  board_basis,
  apply_stage,
  sort_order,
  notes
)
select
  offer_data.offer_id,
  'percentage_discount',
  'stay',
  'percentage',
  10,
  'All Inclusive',
  'offers',
  10,
  'Seeded baseline contracted discount from Ravenala manual validation.'
from offer_data
where not exists (
  select 1
  from hotel_offer_rules existing
  where existing.hotel_offer_id = offer_data.offer_id
    and existing.rule_type = 'percentage_discount'
    and existing.apply_stage = 'offers'
    and existing.sort_order = 10
);

with offer_pairs as (
  select
    wbl2.id as wbl2_offer_id,
    contract10.id as contract10_offer_id
  from hotel_offers wbl2
  join hotel_offers contract10 on contract10.contract_version_id = wbl2.contract_version_id
  join hotel_contract_versions hcv on hcv.id = wbl2.contract_version_id
  join hotel_contracts hc on hc.id = hcv.hotel_contract_id
  join hotel_list hl on hl.id = hc.hotel_id
  where lower(hl.name) = 'the ravenala attitude'
    and hcv.version_name = '2025-2026 v1'
    and wbl2.offer_code = 'WBL2'
    and contract10.offer_code = 'CONTRACT10'
  limit 1
)
insert into hotel_offer_combinability (
  hotel_offer_id,
  with_offer_code,
  is_allowed,
  notes
)
select
  offer_pairs.wbl2_offer_id,
  'CONTRACT10',
  false,
  'WBL2 should override the baseline contracted discount instead of stacking.'
from offer_pairs
where not exists (
  select 1
  from hotel_offer_combinability existing
  where existing.hotel_offer_id = offer_pairs.wbl2_offer_id
    and coalesce(existing.with_offer_code, '') = 'CONTRACT10'
);

with offer_pairs as (
  select
    wbl2.id as wbl2_offer_id,
    contract10.id as contract10_offer_id
  from hotel_offers wbl2
  join hotel_offers contract10 on contract10.contract_version_id = wbl2.contract_version_id
  join hotel_contract_versions hcv on hcv.id = wbl2.contract_version_id
  join hotel_contracts hc on hc.id = hcv.hotel_contract_id
  join hotel_list hl on hl.id = hc.hotel_id
  where lower(hl.name) = 'the ravenala attitude'
    and hcv.version_name = '2025-2026 v1'
    and wbl2.offer_code = 'WBL2'
    and contract10.offer_code = 'CONTRACT10'
  limit 1
)
insert into hotel_offer_combinability (
  hotel_offer_id,
  with_offer_code,
  is_allowed,
  notes
)
select
  offer_pairs.contract10_offer_id,
  'WBL2',
  false,
  'Baseline contracted discount should not stack with WBL2.'
from offer_pairs
where not exists (
  select 1
  from hotel_offer_combinability existing
  where existing.hotel_offer_id = offer_pairs.contract10_offer_id
    and coalesce(existing.with_offer_code, '') = 'WBL2'
);

update hotel_pricing_test_cases
set
  expected_applied_offer_codes = array['CONTRACT10']::text[],
  expected_rejected_offer_codes = array['WBL2']::text[],
  notes = 'Use this to verify compulsory gala charges are added separately and the baseline contracted 10% applies when WBL2 does not.'
where label = 'Ravenala festive family suite with gala dinner';
