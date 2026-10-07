-- Track practice against the four shared goals in Sam's Functional Communication Plan.

alter table activities add column if not exists plan_goal text not null default 'other'
  check (plan_goal in ('unexpected','instructions','narrative','conversation','other'));

alter table practice_records add column if not exists plan_goal text not null default 'other';
alter table practice_records add column if not exists support_code text check (support_code in ('I','M','P','F'));
alter table practice_records add column if not exists success boolean;          -- null = not counted
alter table practice_records add column if not exists visual_aids jsonb not null default '[]'::jsonb;
alter table practice_records add column if not exists sam_turns int;

create index if not exists practice_records_goal on practice_records(learner_id, plan_goal, created_at);

-- Sam practises on an iPad; older devices were labelled "Sam's phone" by default.
update devices set label = 'Sam''s device' where label = 'Sam''s phone';
