ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS cancellation_type text,
ADD COLUMN IF NOT EXISTS cancellation_date date,
ADD COLUMN IF NOT EXISTS cancellation_actioned_by text,
ADD COLUMN IF NOT EXISTS cancellation_checklist jsonb,
ADD COLUMN IF NOT EXISTS cancellation_notes text;
