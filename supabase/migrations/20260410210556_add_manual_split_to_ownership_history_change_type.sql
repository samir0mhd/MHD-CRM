
ALTER TABLE booking_ownership_history
  DROP CONSTRAINT booking_ownership_history_change_type_check;

ALTER TABLE booking_ownership_history
  ADD CONSTRAINT booking_ownership_history_change_type_check
  CHECK (change_type = ANY (ARRAY[
    'initial_assignment',
    'manager_reassignment',
    'claim_approved',
    'claim_rejected',
    'repeat_client_enforcement',
    'manual_split'
  ]));
;
