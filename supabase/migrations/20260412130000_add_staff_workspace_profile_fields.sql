alter table staff_users
  add column if not exists job_title text,
  add column if not exists profile_photo_url text,
  add column if not exists email_signature text;

update staff_users
set job_title = case
  when role = 'manager' then 'Manager'
  when role = 'operations' then 'Operations'
  when role = 'sales' then 'Sales Consultant'
  else null
end
where job_title is null;
