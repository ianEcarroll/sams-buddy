-- Changing a password signs the team member out on every other device (sign-ins last up to 30 days on phones).
alter table adults add column if not exists password_changed_at timestamptz;
