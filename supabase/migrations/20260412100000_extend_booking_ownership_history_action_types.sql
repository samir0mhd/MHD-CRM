alter table booking_ownership_history
  drop constraint if exists booking_ownership_history_change_type_check;

alter table booking_ownership_history
  add constraint booking_ownership_history_change_type_check
  check (change_type in (
    'initial_assignment',
    'manager_reassignment',
    'claim_approved',
    'claim_rejected',
    'repeat_client_enforcement',
    'manual_split',
    'manual_unsplit',
    'manual_split_replaced'
  ));
