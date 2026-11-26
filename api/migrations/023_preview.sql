-- "Try as Sam": a grown-up can run any activity exactly as Sam sees it. Preview devices and their
-- sessions are flagged so they never save records, send emails or count in anyone's numbers.
alter table devices add column if not exists preview boolean not null default false;
alter table practice_sessions add column if not exists preview boolean not null default false;
