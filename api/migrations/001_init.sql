-- Sam's Buddy v1 schema
create extension if not exists pgcrypto;

create table if not exists learners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  current_activity_id uuid,
  created_at timestamptz not null default now()
);

-- Adults: parent (owner), speech therapist, teacher, job coach
create table if not exists adults (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null check (role in ('parent','therapist','teacher','job_coach')),
  is_owner boolean not null default false,
  pass_hash text not null,
  created_at timestamptz not null default now()
);

-- Sam's own consent. Only Sam's device can change who sees his records.
create table if not exists consent (
  learner_id uuid primary key references learners(id) on delete cascade,
  agreed_at timestamptz,
  can_view jsonb not null default '{"parent":true,"therapist":true,"teacher":false,"job_coach":false}'::jsonb,
  save_audio boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  label text not null default 'Sam''s phone',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);

create table if not exists pairing_codes (
  code_hash text primary key,
  learner_id uuid not null references learners(id) on delete cascade,
  created_by uuid references adults(id) on delete set null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists images (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  mime text not null,
  data bytea not null,
  alt text,
  created_at timestamptz not null default now()
);

-- One activity = one goal in one mode, with its items, words and cues.
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  mode text not null check (mode in ('story','object','conversation','task')),
  title text not null,
  goal text not null default '',
  status text not null default 'active' check (status in ('draft','active','archived')),
  content jsonb not null default '{}'::jsonb,   -- items, vocabulary, cues, prompts, review focus
  created_by uuid references adults(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists practice_sessions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  activity_id uuid references activities(id) on delete set null,
  activity_snapshot jsonb not null,
  state jsonb not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_reason text
);

-- Every line Buddy said and every response Sam gave, in order.
create table if not exists practice_events (
  id bigserial primary key,
  session_id uuid not null references practice_sessions(id) on delete cascade,
  who text not null check (who in ('buddy','sam','system')),
  kind text not null,
  text text not null default '',
  meta jsonb not null default '{}'::jsonb,
  audio bytea,
  audio_mime text,
  created_at timestamptz not null default now()
);
create index if not exists practice_events_session on practice_events(session_id, id);

-- The short practice record, one per item practised.
create table if not exists practice_records (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  session_id uuid not null references practice_sessions(id) on delete cascade,
  activity_id uuid references activities(id) on delete set null,
  activity_title text not null,
  mode text not null,
  item_label text not null default '',
  goal text not null,
  sam_response text not null default '',
  independent jsonb not null default '[]'::jsonb,
  support_provided jsonb not null default '[]'::jsonb,
  after_support jsonb not null default '[]'::jsonb,
  help_requests jsonb not null default '[]'::jsonb,
  review_note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists practice_records_learner on practice_records(learner_id, created_at desc);

create table if not exists observations (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  adult_id uuid references adults(id) on delete set null,
  setting text not null check (setting in ('home','school','work','therapy','other')),
  skill text not null default '',
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now());
