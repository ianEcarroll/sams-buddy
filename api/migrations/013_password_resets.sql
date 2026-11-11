-- "Forgot password": single-use links, valid for an hour. Only a hash of the link's token is stored.
create table if not exists password_resets (
  token_hash text primary key,
  adult_id uuid not null references adults(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists password_resets_adult on password_resets (adult_id);
