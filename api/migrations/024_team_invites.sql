-- Invite a team member by link: they choose their own password, so nobody has to invent and pass on a temporary one.
create table if not exists team_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  learner_id uuid not null references learners(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('parent','therapist','teacher','job_coach')),
  created_by uuid references adults(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
