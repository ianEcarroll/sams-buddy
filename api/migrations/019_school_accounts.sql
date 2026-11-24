-- Therapist / school accounts: an invite can be for a school or therapist (not a family), and a student a therapist
-- creates is linked to them as its main contact (owner).
alter table invites add column if not exists kind text not null default 'family';
alter table adult_learners add column if not exists is_owner boolean not null default false;
