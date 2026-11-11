-- Buddy's generated speech, kept so identical lines (stories, "Make a movie in your mind.", welcomes)
-- are paid for once rather than after every restart. Keyed by a hash of voice + model + speed + text.
create table if not exists tts_cache (
  key text primary key,
  model text not null,
  voice_id text not null,
  chars integer not null,
  audio bytea not null,
  bytes integer not null,
  hits integer not null default 0,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);
create index if not exists tts_cache_last_used on tts_cache (last_used_at);
