alter table booking_profit_events
  drop constraint if exists booking_profit_events_type_check;

alter table booking_profit_events
  add constraint booking_profit_events_type_check
    check (type in (
      'original',
      'amendment',
      'recognition',
      'split_correction',
      'cancellation_retained_deposit'
    ));
