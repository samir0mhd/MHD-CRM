update deals
set next_activity_type = 'FOLLOW_UP'
where next_activity_at is not null
  and (next_activity_type is null or nullif(btrim(next_activity_type), '') is null);

update deals
set next_activity_note = 'Follow up with client'
where next_activity_at is not null
  and (next_activity_note is null or nullif(btrim(next_activity_note), '') is null);

alter table deals
drop constraint if exists deals_next_action_integrity_chk;

alter table deals
add constraint deals_next_action_integrity_chk
check (
  (
    next_activity_at is null
    and next_activity_type is null
    and next_activity_note is null
  )
  or (
    next_activity_at is not null
    and next_activity_type in ('CALL', 'EMAIL', 'WHATSAPP', 'NOTE', 'MEETING', 'FOLLOW_UP', 'DECISION_PUSH')
    and nullif(btrim(next_activity_note), '') is not null
  )
);
