INSERT INTO staff_users (name, role, is_active)
SELECT 'Samir Abattouy', 'manager', true
WHERE NOT EXISTS (
  SELECT 1 FROM staff_users WHERE name = 'Samir Abattouy'
);
