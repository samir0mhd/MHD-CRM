
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS cancellation_type       text CHECK (cancellation_type IN ('deposit_only','post_payment','tickets_issued')),
  ADD COLUMN IF NOT EXISTS cancellation_date       date,
  ADD COLUMN IF NOT EXISTS cancellation_actioned_by text,
  ADD COLUMN IF NOT EXISTS cancellation_checklist  jsonb DEFAULT '{}';

-- booking_status is already text, values 'active'|'cancelled' — no enum change needed
-- Update any existing rows that have cancellation_notes set but no status change (safety, no-op on empty DB)
;
