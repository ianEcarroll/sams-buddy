-- Practice reminders (web push) on Sam's devices.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  device_id uuid not null references devices(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table learners add column if not exists last_reminder_on date;
