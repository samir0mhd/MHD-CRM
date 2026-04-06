# Hotel Pricing Engine Blueprint

## Why This Module Exists

Today the CRM stores hotel master data in `hotel_list`, but hotel net pricing is still entered manually into quotes and bookings. That works for quick quoting, but it does not scale once pricing depends on:

- date bands / seasons
- room-level occupancy rules
- child and teen bands
- board supplements
- gala dinners and compulsory charges
- hotel-specific special offers
- offer stacking and combinability
- contract versioning

At 80+ hotels, the problem is not just data entry. The real problem is rule consistency and pricing traceability.

This module should become the pricing brain for accommodation net costs.

## Product Principles

1. Do not build 87 hotels as custom logic.
2. Build one generic engine and feed it hotel-specific contract data.
3. Separate the pricing engine from PDF import.
4. Every result must be explainable line by line.
5. Contract math must be versioned and auditable.
6. Manual override should remain possible, but the system must show where it diverged from engine pricing.

## Existing CRM Integration Points

Current relevant pieces in the app:

- `hotel_list` on [app/hotels/page.tsx](/Users/samir/MHD-CRM/app/hotels/page.tsx)
- quote accommodation net entry on [app/quotes/new/page.tsx](/Users/samir/MHD-CRM/app/quotes/new/page.tsx)
- booking accommodations on [app/bookings/[id]/page.tsx](/Users/samir/MHD-CRM/app/bookings/[id]/page.tsx)

The pricing engine should slot into those flows instead of replacing them all at once.

## Architecture Overview

The module should be split into 4 layers:

### 1. Contract Data Layer

Structured hotel contract records:

- hotel contract header
- version and validity window
- season bands
- room rates
- occupancy rules
- child policies
- board supplements
- compulsory charges
- special offers
- offer stacking / combinability

### 2. Pricing Engine Layer

Pure calculation service that receives:

- hotel
- contract version
- stay dates
- room choice
- board choice
- guest ages
- quote context

and returns:

- final net
- line-by-line pricing trace
- applied offers
- rejected offers with reasons

### 3. Admin Layer

Back-office screens for:

- hotel contract versions
- rates by season / room / occupancy
- child policies
- supplements
- compulsory charges
- offers
- pricing test sandbox

### 4. CRM Integration Layer

Used inside:

- quotes
- multi-centre quotes
- booking accommodation costing
- future supplier / report tooling

## Core Data Model

The names below are proposals. We can adjust later, but the separation is important.

### Hotel-Level Tables

- `hotel_contracts`
  - `id`
  - `hotel_id`
  - `name`
  - `currency`
  - `market`
  - `supplier_reference`
  - `default_board_basis`
  - `status`
  - `notes`
  - `created_at`

- `hotel_contract_versions`
  - `id`
  - `hotel_contract_id`
  - `version_name`
  - `valid_from`
  - `valid_to`
  - `booking_from`
  - `booking_to`
  - `issued_at`
  - `supersedes_version_id`
  - `is_active`
  - `source_document_name`
  - `source_document_url`
  - `notes`

### Season / Rate Tables

- `hotel_contract_seasons`
  - `id`
  - `contract_version_id`
  - `season_code`
  - `season_name`
  - `travel_from`
  - `travel_to`
  - `sort_order`

- `hotel_room_contracts`
  - `id`
  - `contract_version_id`
  - `room_name`
  - `room_code`
  - `room_group`
  - `min_pax`
  - `max_pax`
  - `max_adults`
  - `max_children`
  - `max_infants`
  - `room_notes`

- `hotel_room_rates`
  - `id`
  - `room_contract_id`
  - `season_id`
  - `board_basis`
  - `pricing_model`
  - `rate_value`
  - `rate_unit`
  - `single_rate_value`
  - `triple_rate_value`
  - `currency`
  - `notes`

`pricing_model` examples:

- `per_person_per_night`
- `per_room_per_night`
- `per_unit_per_stay`

### Occupancy / Child Tables

- `hotel_room_occupancy_rates`
  - `id`
  - `room_rate_id`
  - `occupancy_code`
  - `adults`
  - `children`
  - `infants`
  - `age_band_code`
  - `rate_value`
  - `notes`

- `hotel_child_policies`
  - `id`
  - `contract_version_id`
  - `room_contract_id` nullable
  - `board_basis` nullable
  - `child_band_name`
  - `age_from`
  - `age_to`
  - `pricing_method`
  - `value`
  - `applies_when_sharing_with`
  - `max_children_at_this_rule`
  - `priority`
  - `notes`

`pricing_method` examples:

- `percentage_discount`
- `fixed_rate_per_night`
- `free`
- `same_as_adult`

### Supplements / Mandatory Charges

- `hotel_supplements`
  - `id`
  - `contract_version_id`
  - `room_contract_id` nullable
  - `season_id` nullable
  - `supplement_type`
  - `board_from`
  - `board_to`
  - `pricing_method`
  - `value`
  - `per_person`
  - `per_night`
  - `age_from` nullable
  - `age_to` nullable
  - `notes`

- `hotel_compulsory_charges`
  - `id`
  - `contract_version_id`
  - `charge_name`
  - `charge_code`
  - `pricing_method`
  - `value`
  - `per_person`
  - `per_night`
  - `stay_date_from`
  - `stay_date_to`
  - `booking_date_from` nullable
  - `booking_date_to` nullable
  - `age_from` nullable
  - `age_to` nullable
  - `notes`

### Offer Tables

- `hotel_offers`
  - `id`
  - `contract_version_id`
  - `offer_code`
  - `offer_name`
  - `offer_family`
  - `status`
  - `booking_from`
  - `booking_to`
  - `travel_from`
  - `travel_to`
  - `minimum_nights`
  - `maximum_nights` nullable
  - `description`
  - `priority`
  - `stop_after_apply`
  - `notes`

- `hotel_offer_rules`
  - `id`
  - `hotel_offer_id`
  - `rule_type`
  - `target_scope`
  - `pricing_method`
  - `value`
  - `age_from` nullable
  - `age_to` nullable
  - `room_name` nullable
  - `board_basis` nullable
  - `day_of_week` nullable
  - `free_night_pattern` nullable
  - `apply_stage`
  - `sort_order`
  - `notes`

- `hotel_offer_combinability`
  - `id`
  - `hotel_offer_id`
  - `with_offer_family` nullable
  - `with_offer_code` nullable
  - `is_allowed`
  - `notes`

## Rule Taxonomy

The engine should support reusable offer families instead of hotel-specific code branches.

### Core Offer Families

- `percentage_discount`
- `fixed_discount`
- `free_night`
- `stay_pay`
- `meal_plan_upgrade`
- `child_discount`
- `honeymoon`
- `anniversary`
- `repeat_guest`
- `early_booking`
- `long_stay`
- `booking_window_extension`

### Support Needed In The Rule Model

Each rule should declare:

- what it applies to
- when it applies
- whether it stacks
- what stage of the calculation it belongs to
- whether it is prorated across seasons
- whether it touches room only, board only, or full price

## Calculation Pipeline

This is the most important part of the module.

### Stage 1. Resolve Contract Context

- pick hotel
- pick contract version
- validate booking date
- validate travel date
- validate selected room and board

### Stage 2. Split Stay Into Priced Units

For each stay:

- split by season boundaries
- split by date-specific compulsory events if needed
- keep a nightly price ledger

This is essential for:

- peak / shoulder crossings
- free-night logic
- gala dinner logic

### Stage 3. Resolve Occupancy

Determine:

- adults
- children
- infants
- ages at time of stay
- room occupancy validity

This must support:

- couple-only rooms
- family rooms
- teen vs child bands
- max children rules

### Stage 4. Build Base Room Price

Using contract season + room + occupancy:

- get base adult price
- derive single / double / triple / room-based pricing
- create nightly base rows

### Stage 5. Apply Pax-Specific Pricing

This is where child logic happens.

Important confirmed rule from user:

`child rate / child discount must be applied before the overall hotel discount`

So this stage should handle:

- child free
- child fixed rate
- child percentage discount
- teen-specific rate

before any broad promotional offer such as `27% off`.

### Stage 6. Apply Contract Supplements

Apply:

- board uplifts
- room supplements
- occupancy supplements
- per person / per night extras

### Stage 7. Apply Compulsory Charges

Apply things like:

- Christmas gala dinner
- New Year gala dinner
- compulsory festive surcharge

These should be explicit lines in the ledger, not hidden in room net.

### Stage 8. Evaluate Offer Eligibility

For each offer:

- booking window valid?
- travel window valid?
- minimum nights valid?
- room scope valid?
- pax scope valid?
- combinability valid?

Return:

- `eligible`
- `rejected`
- rejection reason

### Stage 9. Apply Offer Stack

Offers should be applied in configured order.

Proposed default order:

1. pax-specific rules already handled earlier
2. board upgrade promotional rules
3. free-night / stay-pay rules
4. fixed-value promotional discounts
5. percentage discounts

This order must remain data-driven where hotels need something different.

### Stage 10. Return A Pricing Trace

The engine output must include:

- base total
- each adjustment line
- each compulsory charge line
- each applied offer
- each rejected offer with reason
- final accommodation net

## Free Night Logic

Free-night offers are one of the hardest pieces.

The engine must support:

- every X nights, Y nights free
- cheapest night free
- first or last night free
- pro-rated free nights across split seasons
- free nights with or without supplements

Recommended design:

- nightly ledger first
- free-night offer selects which ledger rows become discounted
- supplements can declare whether they are discountable or excluded

## Meal Plan Upgrade Logic

Meal-plan upgrades should not be treated like a normal percentage discount.

Model them as:

- change of priced board basis
- with an override on supplement amount

Examples:

- HB to AI upgrade free
- AI supplement at 50%
- one adult free upgrade, child paid

That means the engine needs to understand board basis as a first-class pricing object, not just text.

## Contract Versioning

This module must support version history cleanly.

Needed behaviors:

- contract version can be superseded
- old quotes keep their original calculated source version
- repricing can be run against a later version
- audit trail shows which contract version was used

## Pricing Trace Output Shape

The quote / booking integration should eventually show something like:

```text
Ravenala Attitude
Contract: UK/IRELAND 2025/2026 v1
Stay: 7 nights, 2 adults + 1 child age 8
Room: Family Suite
Board: All Inclusive

Base adult nightly price: ...
Child reduction applied first: ...
Board supplement: ...
Gala dinner: ...
Offer WBL2 applied: 27% ...

Final accommodation net: ...
```

This is non-negotiable. Without this, users will not trust the module.

## Phase Plan

### Phase 1. Ravenala Pilot

Goal:

- prove the engine against one real contract and one real offer

Scope:

- one hotel
- one contract version
- one room family set
- one child rule set
- gala dinner support
- one promotional offer
- pricing sandbox screen
- trace output

No PDF import yet.

### Phase 2. Contract Admin

- back-office contract entry UI
- offer management UI
- versioning controls
- contract duplication / rollover

### Phase 3. Quote Integration

- `Price From Contract` in quote option panel
- persist calculation snapshot on the quote
- allow manual override with visible reason

### Phase 4. Booking Integration

- push selected contract net into booking accommodations
- preserve calculation source and trace
- support post-booking repricing checks when needed

### Phase 5. Scale-Out

- more hotels
- more offer families
- contract QA tools
- PDF-assisted import helpers

## What Should Stay Manual At First

Do not automate these too early:

- parsing all supplier PDFs
- unclear combinability clauses
- fuzzy wording like "best offer applies" without examples
- automatic amendment of old quotes when contracts change

## First Build Deliverables

The first real deliverables should be:

1. schema migration set
2. Ravenala contract seed data
3. pricing service with test cases
4. sandbox UI for one hotel
5. trace output matching manual calculations

## Future Integration In Quotes

The current quote builder stores accommodation net manually in fields like `accNet`.

Future quote flow:

1. consultant chooses hotel, room, board, check-in, nights, adults, children/teens with ages, and any manual special-offer trigger such as `HM Offers`
2. engine returns calculated net
3. user can accept:
   - calculated net
   - or override manually
4. quote stores:
   - calculated net
   - contract version id
   - applied offer ids
   - trace snapshot
   - override reason if changed

This gives you automation without losing control.

## Risks To Respect

- occupancy logic is harder than pricing tables
- free-night logic across season boundaries will expose bad assumptions fast
- supplier PDFs will often be ambiguous
- stacking rules must be explicit or the engine will drift from real pricing behavior

## Immediate Next Technical Step

After review, the next implementation step should be:

`create the schema + Ravenala seed model + pricing sandbox`

That is the point where the module becomes tangible.
