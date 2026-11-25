-- One code for a whole class: the student enters it on their iPad and taps their own name.
create table if not exists class_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  adult_id uuid not null references adults(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table devices add column if not exists class_code_id uuid references class_codes(id) on delete set null;
