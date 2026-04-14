ALTER TABLE staff_users
ADD COLUMN IF NOT EXISTS auth_user_id uuid,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS mfa_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS mfa_enrolled_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS staff_users_auth_user_id_key
ON staff_users(auth_user_id)
WHERE auth_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS staff_users_email_key
ON staff_users(email)
WHERE email IS NOT NULL;
UPDATE staff_users
SET email = 'samir@mauritiusholidaysdirect.co.uk',
    mfa_required = true
WHERE name = 'Samir Abattouy'
  AND email IS NULL;
