-- A teacher or therapist who cannot see a student's practice can ask; the student's main grown-up allows or declines.
create table if not exists share_requests (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  adult_id uuid not null references adults(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  outcome text check (outcome in ('allowed','declined'))
);
create index if not exists share_requests_open on share_requests(learner_id) where resolved_at is null;
