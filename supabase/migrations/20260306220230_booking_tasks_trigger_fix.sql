-- Fix booking_tasks table structure to support automatic checklist generation

alter table booking_tasks
add column if not exists task_key text;
alter table booking_tasks
add column if not exists sort_order integer;
alter table booking_tasks
add column if not exists is_done boolean not null default false;
alter table booking_tasks
add column if not exists completed_at timestamp;
-- Copy old data if needed
update booking_tasks
set is_done = completed
where completed is not null;
update booking_tasks
set task_key = task_name
where task_key is null and task_name is not null;
-- Create trigger function
create or replace function create_default_booking_tasks()
returns trigger
language plpgsql
as $$
begin
  insert into booking_tasks (booking_id, task_name, task_key, sort_order, is_done)
  values
    (new.id, 'Deposit received', 'DEPOSIT_RECEIVED', 10, false),
    (new.id, 'Balance due date set', 'BALANCE_DUE_DATE_SET', 20, false),
    (new.id, 'Flights confirmed', 'FLIGHTS_CONFIRMED', 30, false),
    (new.id, 'Accommodation confirmed', 'ACCOMMODATION_CONFIRMED', 40, false),
    (new.id, 'Transfers confirmed', 'TRANSFERS_CONFIRMED', 50, false),
    (new.id, 'Special requests logged', 'SPECIAL_REQUESTS_LOGGED', 60, false),
    (new.id, 'Wedding / event logistics', 'WEDDING_EVENT_LOGISTICS', 70, false),
    (new.id, 'Documents issued', 'DOCUMENTS_ISSUED', 80, false),
    (new.id, 'Pre-departure touch', 'PRE_DEPARTURE_TOUCH', 90, false),
    (new.id, 'Post-trip review request', 'POST_TRIP_REVIEW_REQUEST', 100, false);

  return new;
end;
$$;
drop trigger if exists trg_create_default_booking_tasks on bookings;
create trigger trg_create_default_booking_tasks
after insert on bookings
for each row
execute function create_default_booking_tasks();
