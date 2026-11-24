-- A therapist or teacher can look after more than one student. Their account stays with one learner (adults.learner_id);
-- this table adds the other learners they can open. The parent of each learner is who adds them to the team.
create table if not exists adult_learners (
  adult_id uuid not null references adults(id) on delete cascade,
  learner_id uuid not null references learners(id) on delete cascade,
  added_by uuid references adults(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (adult_id, learner_id)
);
create index if not exists adult_learners_learner on adult_learners(learner_id);
