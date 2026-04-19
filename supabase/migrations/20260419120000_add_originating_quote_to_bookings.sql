-- Add originating quote linkage to bookings
-- Enables full traceability from booking back to the exact quote that was converted.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS originating_quote_ref  text,
  ADD COLUMN IF NOT EXISTS originating_quote_id   bigint references quotes(id);

COMMENT ON COLUMN bookings.originating_quote_ref IS
  'The quote reference (e.g. 190426SA01) that this booking was converted from';
COMMENT ON COLUMN bookings.originating_quote_id IS
  'The specific quotes.id row (highest-profit option) that this booking was converted from';
