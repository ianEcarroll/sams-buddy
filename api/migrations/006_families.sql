-- Many families: invite links, an optional year of birth for each child, and pausing a family.
alter table learners add column if not exists birth_year smallint;
alter table learners add column if not exists disabled_at timestamptz;

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  note text not null default '',
  created_by uuid references adults(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  learner_id uuid references learners(id) on delete set null
);
