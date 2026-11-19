-- Waiting list for the TALVO website: one row per email address.
create table if not exists waitlist (
  id serial primary key,
  email text not null unique,
  role text check (role in ('parent','therapist','school','other')),
  source text not null default 'website',
  created_at timestamptz not null default now()
);
