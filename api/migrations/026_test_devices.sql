-- Testing must not land in a learner's records. A connected device can be marked as a test device: it behaves like
-- "Try as Sam" (nothing saved or counted). A practice already saved can be hidden from counts and reports (kept, restorable).
alter table devices add column if not exists test boolean not null default false;
alter table practice_records add column if not exists hidden_at timestamptz;
alter table practice_records add column if not exists hidden_by text;
