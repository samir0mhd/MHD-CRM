-- commission_bonus_events: one row per staff per recognition period when they hit a bonus tier
CREATE TABLE IF NOT EXISTS commission_bonus_events (
  id          BIGSERIAL PRIMARY KEY,
  staff_id    INTEGER NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  period      VARCHAR(7) NOT NULL,           -- 'YYYY-MM' recognition month
  bonus_amount NUMERIC(10,2) NOT NULL,
  tier        VARCHAR(20) NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold')),
  recognised_profit NUMERIC(10,2) NOT NULL,  -- recognised profit at the time of computation
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, period)
);

-- Add bonus columns to commission_payroll_sheets so issued sheets snapshot the tier bonus
ALTER TABLE commission_payroll_sheets
  ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_tier   VARCHAR(20);
