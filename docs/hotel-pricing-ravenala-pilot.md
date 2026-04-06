# Ravenala Pilot Scope

## Purpose

Use `The Ravenala Attitude` as the pilot hotel for the accommodation pricing engine.

The pilot is not trying to solve every hotel. It is trying to prove:

- contract data can be normalized
- occupancy and child logic can be calculated correctly
- supplements and gala dinners can be represented cleanly
- promotional offers can be applied in the right order
- the engine can explain its work

## Source Material

Pilot reference files:

- [GBP THE RAVENALA ATTITUDE - 2025 2026.1.pdf](/Users/samir/Downloads/GBP%20THE%20RAVENALA%20ATTITUDE%20-%202025%202026.1.pdf)
- [The Ravenala Attitude Winter Blues Offer Extension 13.03.2026.pdf](/Users/samir/Downloads/The%20Ravenala%20Attitude%20Winter%20Blues%20Offer%20Extension%2013.03.2026.pdf)

## What The Sample Contract Proves

The contract already forces support for:

- seasonal rate bands
- multiple room categories
- double / single / triple behavior
- family occupancy
- separate child and teen handling
- all-inclusive base pricing
- festive compulsory gala dinners
- minimum stay rules

## What The Sample Offer Proves

The `Winter Blues` offer already forces support for:

- booking window rules
- travel window rules
- minimum stay rules
- percentage discount on all rooms / pax sharing
- separate child discount logic
- offer code storage
- offer combinability

## Confirmed Commercial Rule

User confirmed:

`child pricing should be discounted first, then apply the overall discount such as 27%`

This must be implemented as a formal calculation rule, not as a comment in code.

## Pilot Calculation Order

For the Ravenala pilot, the engine should work in this order:

1. resolve contract version
2. resolve season per night
3. resolve room occupancy
4. calculate base adult net
5. apply child / teen pricing adjustments
6. apply board or room supplements if relevant
7. add compulsory gala dinners
8. check offer eligibility
9. apply `WBL2` offer
10. produce final net plus trace

## Pilot Offer Family Support

Phase 1 only needs to prove these families:

- `percentage_discount`
- `child_discount`
- `compulsory_charge`

Optional if needed by the pilot data:

- `meal_plan_upgrade`

Free-night logic does not need to be built in phase 1 unless the Ravenala pilot expands to include it.

## Ravenala Admin Inputs Needed In The Sandbox

The pilot calculator should accept:

- stay dates
- booking date
- room category
- board basis
- adults
- children
- child ages
- teens
- teen ages
- special-offer triggers such as `HM Offers`

Recommended output:

- contract version used
- season breakdown
- nightly room cost
- child pricing line
- gala dinner line
- offer line
- final accommodation net

## Pilot Test Case Format

Every pricing test should be stored with:

- booking date
- check-in date
- check-out date
- nights
- room type
- board basis
- adults
- child ages
- expected applied offers
- expected rejected offers
- expected final net
- notes on the manual commercial reasoning

## Suggested First Test Cases

### Case 1. Plain Contract

- no campaign offer
- normal travel window
- simplest valid occupancy

Goal:

- prove base season / room / occupancy pricing plus the year-round contracted discount

### Case 2. Child Logic

- same stay shape with child age in the valid child band

Goal:

- prove child pricing is resolved before broad offer logic

### Case 3. Winter Blues Offer

- valid booking date
- valid travel date
- minimum 5 nights
- room eligible

Goal:

- prove `WBL2` applies after child pricing

### Case 4. Offer Rejected

- booking outside window or travel outside window

Goal:

- prove offer rejection is explicit, not silent

### Case 5. Festive Charge

- stay overlaps gala dinner dates

Goal:

- prove compulsory charges are added separately and visibly

## Sandbox Success Criteria

The Ravenala pilot is successful when:

1. you can enter a real stay and get a result
2. the result matches your manual pricing
3. the output shows every line used to get there
4. rejected offers show the reason
5. we can trust the engine enough to feed `accNet` in quotes

## After Ravenala

Once the pilot is correct, the next hotel should be chosen for contrast:

- ideally one with free nights or stay/pay
- ideally one with a meal-plan upgrade offer

That will prove the engine is generic and not just “Ravenala hard-coded.”
