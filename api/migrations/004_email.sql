-- Each team member can ask for an email after every practice (off by default).
alter table adults add column if not exists email_after_practice boolean not null default false;
