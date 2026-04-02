update hotel_offers ho
set
  booking_from = null,
  booking_to = null,
  travel_from = date '2025-11-01',
  travel_to = date '2026-10-31',
  status = 'active',
  priority = 90,
  notes = 'Baseline contracted discount applies year-round unless a higher-priority non-combinable campaign overrides it.'
from hotel_contract_versions hcv
join hotel_contracts hc on hc.id = hcv.hotel_contract_id
join hotel_list hl on hl.id = hc.hotel_id
where ho.contract_version_id = hcv.id
  and lower(hl.name) = 'the ravenala attitude'
  and hcv.version_name = '2025-2026 v1'
  and ho.offer_code = 'CONTRACT10';

update hotel_pricing_test_cases
set
  expected_applied_offer_codes = array['CONTRACT10']::text[],
  expected_rejected_offer_codes = array['WBL2']::text[],
  notes = 'Use this to verify the year-round contracted 10% applies when no stronger campaign offer is valid.'
where label = 'Ravenala base family suite without offer';
