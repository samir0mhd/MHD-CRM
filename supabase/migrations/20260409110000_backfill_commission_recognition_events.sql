-- Backfill commission recognition events for bookings that:
--   1. Have balance_cleared_at set (full payment received)
--   2. Have final_profit > 0 (costing has been pushed)
--   3. Have NO commissionable profit event (commission recognition was never created)
--
-- Root cause: commission recognition was tied to the "Push to Overview" button click.
-- Bookings where push happened before payment cleared had non-commissionable events only.
-- This migration creates a 'recognition' event + allocations for all such bookings,
-- making them visible in the commission report which now filters to commissionable events.
--
-- Safe to run multiple times: the NOT EXISTS guard prevents duplicate events.

WITH new_events AS (
  INSERT INTO booking_profit_events (booking_id, type, profit_delta, commissionable, recognition_period)
  SELECT
    b.id                                                                      AS booking_id,
    'recognition'                                                             AS type,
    b.final_profit                                                            AS profit_delta,
    true                                                                      AS commissionable,
    to_char(b.balance_cleared_at AT TIME ZONE 'UTC', 'YYYY-MM')              AS recognition_period
  FROM bookings b
  WHERE
    b.balance_cleared_at IS NOT NULL
    AND b.final_profit    IS NOT NULL
    AND b.final_profit    >  0
    AND b.status          != 'cancelled'
    AND NOT EXISTS (
      SELECT 1
      FROM booking_profit_events bpe
      WHERE bpe.booking_id    = b.id
        AND bpe.commissionable = true
    )
  RETURNING id, booking_id, profit_delta
)
INSERT INTO booking_profit_allocations (profit_event_id, staff_id, share_percent, profit_share)
SELECT
  ne.id                                                                AS profit_event_id,
  bc.staff_id,
  bc.share_percent,
  ROUND((ne.profit_delta * bc.share_percent / 100)::numeric, 2)       AS profit_share
FROM new_events    ne
JOIN booking_commissions bc ON bc.booking_id = ne.booking_id;
